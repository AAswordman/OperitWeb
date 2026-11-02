#!/usr/bin/env python3
"""Check and recreate Git symlinks inside project submodules.
用于修复一些奇奇怪怪权限问题导致的子模块clone时没有正确的软链接
Git stores symbolic links as tree entries with mode 120000. On Windows, those
entries can appear in the working tree as tiny plain files containing the link
target. This script compares the checked-out files against the Git tree and can
recreate the broken entries as real symbolic links.
"""

from __future__ import annotations

import argparse
import configparser
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Submodule:
    repo_root: Path
    path: Path

    @property
    def worktree(self) -> Path:
        return self.repo_root / self.path

    @property
    def display_path(self) -> str:
        return self.path.as_posix()


@dataclass(frozen=True)
class GitSymlink:
    submodule: Submodule
    path: Path
    target: str

    @property
    def worktree_path(self) -> Path:
        return self.submodule.worktree / self.path

    @property
    def display_path(self) -> str:
        return f"{self.submodule.display_path}/{self.path.as_posix()}"


@dataclass(frozen=True)
class LinkProblem:
    link: GitSymlink
    status: str
    detail: str


def run_git(repo: Path, *args: str) -> bytes:
    command = ["git", "-C", str(repo), *args]
    try:
        return subprocess.check_output(command, stderr=subprocess.STDOUT)
    except FileNotFoundError as exc:
        raise RuntimeError("git executable was not found") from exc
    except subprocess.CalledProcessError as exc:
        output = exc.output.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"{' '.join(command)} failed: {output}") from exc


def read_gitmodules(repo_root: Path) -> list[Path]:
    gitmodules = repo_root / ".gitmodules"
    if not gitmodules.exists():
        return []

    parser = configparser.ConfigParser()
    parser.optionxform = str
    parser.read(gitmodules, encoding="utf-8")

    paths: list[Path] = []
    for section in parser.sections():
        if section.startswith("submodule ") and parser.has_option(section, "path"):
            raw_path = parser.get(section, "path").strip()
            paths.append(Path(raw_path))
    return paths


def discover_submodules(repo_root: Path) -> list[Submodule]:
    discovered: list[Submodule] = []
    pending: list[Submodule] = [
        Submodule(repo_root=repo_root, path=path) for path in read_gitmodules(repo_root)
    ]

    while pending:
        submodule = pending.pop(0)
        if submodule in discovered:
            continue

        discovered.append(submodule)
        if not submodule.worktree.exists():
            continue

        for nested_path in read_gitmodules(submodule.worktree):
            pending.append(
                Submodule(
                    repo_root=repo_root,
                    path=submodule.path / nested_path,
                )
            )

    return discovered


def parse_ls_tree_record(record: bytes) -> tuple[str, Path] | None:
    metadata, _, raw_path = record.partition(b"\t")
    if not metadata or not raw_path:
        return None

    fields = metadata.decode("ascii", errors="strict").split()
    if len(fields) != 3:
        return None

    mode = fields[0]
    path = Path(raw_path.decode("utf-8", errors="surrogateescape"))
    return mode, path


def list_git_symlinks(submodule: Submodule) -> list[GitSymlink]:
    raw_tree = run_git(submodule.worktree, "ls-tree", "-r", "-z", "HEAD")
    records = [record for record in raw_tree.split(b"\0") if record]
    links: list[GitSymlink] = []

    for record in records:
        parsed = parse_ls_tree_record(record)
        if parsed is None:
            continue

        mode, path = parsed
        if mode != "120000":
            continue

        target = run_git(submodule.worktree, "show", f"HEAD:{path.as_posix()}").decode(
            "utf-8",
            errors="surrogateescape",
        )
        links.append(GitSymlink(submodule=submodule, path=path, target=target))

    return links


def relative_readlink(path: Path) -> str:
    return os.readlink(path)


def normalize_link_target(target: str) -> str:
    """Normalize platform-specific path spelling for comparison."""
    return os.path.normcase(os.path.normpath(target))


def classify_link(link: GitSymlink) -> LinkProblem | None:
    path = link.worktree_path

    if not os.path.lexists(path):
        return LinkProblem(link, "missing", "path does not exist")

    if path.is_symlink():
        actual_target = relative_readlink(path)
        if normalize_link_target(actual_target) == normalize_link_target(link.target):
            return None
        return LinkProblem(
            link,
            "wrong-target",
            f"points to {actual_target!r}, expected {link.target!r}",
        )

    if path.is_file():
        actual_text = path.read_text(encoding="utf-8", errors="surrogateescape")
        if actual_text == link.target:
            return LinkProblem(
                link,
                "plain-file",
                "checked out as a regular file containing the link target",
            )
        return LinkProblem(link, "not-symlink", "regular file has unexpected content")

    return LinkProblem(link, "not-symlink", f"existing path is {path_stat_kind(path)}")


def path_stat_kind(path: Path) -> str:
    if path.is_dir():
        return "a directory"
    return "not a symbolic link"


def resolve_link_target(link: GitSymlink) -> Path:
    target = Path(link.target)
    if target.is_absolute():
        return target
    return link.worktree_path.parent / target


def target_is_directory(link: GitSymlink, missing_target: str) -> bool:
    resolved_target = resolve_link_target(link)
    if resolved_target.exists():
        return resolved_target.is_dir()
    if missing_target == "file":
        return False
    if missing_target == "dir":
        return True
    raise RuntimeError(
        f"{link.display_path}: target {link.target!r} does not exist; pass "
        "--missing-target file or --missing-target dir when that is intentional"
    )


def remove_replaceable_path(problem: LinkProblem) -> None:
    path = problem.link.worktree_path
    if problem.status in {"missing"}:
        return
    if problem.status in {"plain-file", "wrong-target"}:
        path.unlink()
        return
    raise RuntimeError(f"{problem.link.display_path}: refusing to replace {problem.status}")


def apply_problem(problem: LinkProblem, missing_target: str) -> None:
    link = problem.link
    link.worktree_path.parent.mkdir(parents=True, exist_ok=True)
    remove_replaceable_path(problem)
    is_dir = target_is_directory(link, missing_target)
    os.symlink(link.target, link.worktree_path, target_is_directory=is_dir)


def collect_problems(submodules: list[Submodule]) -> tuple[list[LinkProblem], list[str]]:
    problems: list[LinkProblem] = []
    errors: list[str] = []

    for submodule in submodules:
        if not submodule.worktree.exists():
            errors.append(f"{submodule.display_path}: submodule worktree does not exist")
            continue

        try:
            links = list_git_symlinks(submodule)
        except RuntimeError as exc:
            errors.append(f"{submodule.display_path}: {exc}")
            continue

        for link in links:
            problem = classify_link(link)
            if problem is not None:
                problems.append(problem)

    return problems, errors


def print_report(problems: list[LinkProblem], errors: list[str]) -> None:
    if not problems and not errors:
        print("All submodule symlinks are correctly created.")
        return

    if problems:
        print("Broken submodule symlinks:")
        for problem in problems:
            print(f"- {problem.link.display_path}: {problem.status}; {problem.detail}")

    if errors:
        print("Errors:")
        for error in errors:
            print(f"- {error}")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check and recreate symbolic links recorded by Git submodules."
    )
    parser.add_argument(
        "--root",
        default=".",
        help="repository root; defaults to the current directory",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="recreate broken symlinks that can be replaced safely",
    )
    parser.add_argument(
        "--missing-target",
        choices=("error", "file", "dir"),
        default="error",
        help="how to classify a symlink target that does not currently exist",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    repo_root = Path(args.root).resolve()

    submodules = discover_submodules(repo_root)
    if not submodules:
        print("No submodules were found in .gitmodules.")
        return 0

    problems, errors = collect_problems(submodules)
    print_report(problems, errors)

    if not args.apply:
        return 1 if problems or errors else 0

    apply_errors: list[str] = []
    for problem in problems:
        try:
            apply_problem(problem, args.missing_target)
            print(f"created: {problem.link.display_path} -> {problem.link.target}")
        except OSError as exc:
            apply_errors.append(f"{problem.link.display_path}: {exc}")
        except RuntimeError as exc:
            apply_errors.append(str(exc))

    if apply_errors:
        print("Apply errors:")
        for error in apply_errors:
            print(f"- {error}")
        return 1

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
