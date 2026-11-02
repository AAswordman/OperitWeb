use globset::{Glob, GlobSet, GlobSetBuilder};
use grep_matcher::Matcher;
use grep_regex::{RegexMatcher, RegexMatcherBuilder};
use ignore::WalkBuilder;
use jni::objects::{JClass, JObjectArray, JString};
use jni::sys::{jboolean, jint, jstring, JNI_FALSE};
use jni::JNIEnv;
use serde::Serialize;
use std::cmp::{max, min};
use std::collections::BTreeSet;
use std::fs::File;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchResponse {
    success: bool,
    error: String,
    files_searched: usize,
    blocks: Vec<SearchBlock>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchBlock {
    file_path: String,
    first_match_line: usize,
    line_content: String,
    match_context: String,
    match_count: usize,
}

struct SearchOptions {
    path: PathBuf,
    patterns: Vec<String>,
    file_pattern: String,
    case_insensitive: bool,
    context_lines: usize,
    max_results: usize,
}

struct FileMatch {
    line_number: usize,
    text: String,
}

#[no_mangle]
pub extern "system" fn Java_com_ai_assistance_operit_util_ripgrep_NativeRipgrep_searchJson(
    mut env: JNIEnv,
    _class: JClass,
    path: JString,
    patterns: JObjectArray,
    file_pattern: JString,
    case_insensitive: jboolean,
    _literal: jboolean,
    context_lines: jint,
    max_results: jint,
) -> jstring {
    let result = read_options(
        &mut env,
        path,
        patterns,
        file_pattern,
        case_insensitive != JNI_FALSE,
        context_lines,
        max_results,
    )
    .and_then(run_search);

    let response = match result {
        Ok(response) => response,
        Err(error) => SearchResponse {
            success: false,
            error,
            files_searched: 0,
            blocks: Vec::new(),
        },
    };

    let json = serde_json::to_string(&response).unwrap_or_else(|error| {
        format!(
            r#"{{"success":false,"error":"failed to encode native grep result: {}","filesSearched":0,"blocks":[]}}"#,
            escape_json_fragment(&error.to_string())
        )
    });
    env.new_string(json)
        .map(|value| value.into_raw())
        .unwrap_or(std::ptr::null_mut())
}

fn read_options(
    env: &mut JNIEnv,
    path: JString,
    patterns: JObjectArray,
    file_pattern: JString,
    case_insensitive: bool,
    context_lines: jint,
    max_results: jint,
) -> Result<SearchOptions, String> {
    let path: String = env
        .get_string(&path)
        .map_err(|error| format!("failed to read path: {error}"))?
        .into();
    let file_pattern: String = env
        .get_string(&file_pattern)
        .map_err(|error| format!("failed to read file pattern: {error}"))?
        .into();
    let pattern_count = env
        .get_array_length(&patterns)
        .map_err(|error| format!("failed to read pattern count: {error}"))?;
    let mut pattern_values = Vec::with_capacity(pattern_count as usize);
    for index in 0..pattern_count {
        let pattern = env
            .get_object_array_element(&patterns, index)
            .map_err(|error| format!("failed to read pattern {index}: {error}"))?;
        let pattern: String = env
            .get_string(&JString::from(pattern))
            .map_err(|error| format!("failed to convert pattern {index}: {error}"))?
            .into();
        if !pattern.trim().is_empty() {
            pattern_values.push(pattern);
        }
    }

    if path.trim().is_empty() {
        return Err("path is required".to_string());
    }
    if pattern_values.is_empty() {
        return Err("pattern is required".to_string());
    }

    Ok(SearchOptions {
        path: PathBuf::from(path),
        patterns: pattern_values,
        file_pattern,
        case_insensitive,
        context_lines: context_lines.max(0) as usize,
        max_results: max_results.max(0) as usize,
    })
}

fn run_search(options: SearchOptions) -> Result<SearchResponse, String> {
    let matchers = build_matchers(&options)?;
    let include_globs = build_include_globs(&options.file_pattern)?;
    let exclude_globs = build_exclude_globs()?;
    let mut files_searched = 0usize;
    let mut blocks = Vec::new();

    if options.max_results == 0 {
        return Ok(SearchResponse {
            success: true,
            error: String::new(),
            files_searched,
            blocks,
        });
    }

    let mut walker = WalkBuilder::new(&options.path);
    walker.hidden(false);
    walker.git_ignore(true);
    walker.git_global(true);
    walker.git_exclude(true);
    walker.parents(true);

    for entry in walker.build() {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = entry.file_type();
        if !file_type.map(|value| value.is_file()).unwrap_or(false) {
            continue;
        }

        let path = entry.path();
        if !path_matches(path, &options.path, include_globs.as_ref(), &exclude_globs) {
            continue;
        }
        if is_probably_binary(path) {
            continue;
        }

        files_searched += 1;
        if let Some(block) = search_file(path, &matchers, options.context_lines)? {
            blocks.push(block);
            if blocks.len() >= options.max_results {
                break;
            }
        }
    }

    Ok(SearchResponse {
        success: true,
        error: String::new(),
        files_searched,
        blocks,
    })
}

fn build_matchers(options: &SearchOptions) -> Result<Vec<RegexMatcher>, String> {
    options
        .patterns
        .iter()
        .map(|pattern| {
            let mut builder = RegexMatcherBuilder::new();
            builder.case_insensitive(options.case_insensitive);
            builder
                .build(pattern)
                .map_err(|error| format!("invalid regex `{pattern}`: {error}"))
        })
        .collect()
}

fn build_include_globs(file_pattern: &str) -> Result<Option<GlobSet>, String> {
    let pattern = file_pattern.trim();
    if pattern.is_empty() || pattern == "*" {
        return Ok(None);
    }

    let mut builder = GlobSetBuilder::new();
    builder.add(Glob::new(pattern).map_err(|error| error.to_string())?);
    if !pattern.contains('/') && !pattern.contains('\\') {
        builder.add(Glob::new(&format!("**/{pattern}")).map_err(|error| error.to_string())?);
    }
    builder.build().map(Some).map_err(|error| error.to_string())
}

fn build_exclude_globs() -> Result<GlobSet, String> {
    let mut builder = GlobSetBuilder::new();
    for pattern in [
        ".backup/**",
        "**/.backup/**",
        ".operit/**",
        "**/.operit/**",
        "backup/**",
        "**/backup/**",
    ] {
        builder.add(Glob::new(pattern).map_err(|error| error.to_string())?);
    }
    builder.build().map_err(|error| error.to_string())
}

fn path_matches(
    path: &Path,
    root: &Path,
    include_globs: Option<&GlobSet>,
    exclude_globs: &GlobSet,
) -> bool {
    let relative = path.strip_prefix(root).unwrap_or(path);
    if exclude_globs.is_match(relative) || exclude_globs.is_match(path) {
        return false;
    }
    match include_globs {
        Some(globs) => globs.is_match(relative) || globs.is_match(path),
        None => true,
    }
}

fn is_probably_binary(path: &Path) -> bool {
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(_) => return true,
    };
    let mut buffer = [0u8; 8192];
    match file.read(&mut buffer) {
        Ok(size) => buffer[..size].contains(&0),
        Err(_) => true,
    }
}

fn search_file(
    path: &Path,
    matchers: &[RegexMatcher],
    context_lines: usize,
) -> Result<Option<SearchBlock>, String> {
    let file =
        File::open(path).map_err(|error| format!("failed to open {}: {error}", path.display()))?;
    let reader = BufReader::new(file);
    let mut lines = Vec::new();
    let mut matches = Vec::new();

    for (index, line) in reader.split(b'\n').enumerate() {
        let bytes = line.map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let text = String::from_utf8_lossy(&bytes)
            .trim_end_matches('\r')
            .to_string();
        let is_match = matchers
            .iter()
            .any(|matcher| matcher.is_match(text.as_bytes()).unwrap_or(false));
        let line_number = index + 1;
        if is_match {
            matches.push(FileMatch {
                line_number,
                text: text.clone(),
            });
        }
        lines.push(text);
    }

    if matches.is_empty() {
        return Ok(None);
    }

    let mut context_indexes = BTreeSet::new();
    for item in &matches {
        let start = max(item.line_number.saturating_sub(context_lines), 1);
        let end = min(item.line_number + context_lines, lines.len());
        for line_number in start..=end {
            context_indexes.insert(line_number);
        }
    }

    let match_context = context_indexes
        .into_iter()
        .filter_map(|line_number| lines.get(line_number - 1))
        .map(|line| clip_text(line, 400))
        .collect::<Vec<_>>()
        .join("\n");

    let line_content = if matches.len() == 1 {
        clip_text(&matches[0].text, 300)
    } else {
        let digest = matches
            .iter()
            .take(5)
            .map(|item| clip_text(&item.text, 80))
            .collect::<Vec<_>>()
            .join(" | ");
        format!("{} matches: {}...", matches.len(), clip_text(&digest, 200))
    };

    Ok(Some(SearchBlock {
        file_path: path.to_string_lossy().to_string(),
        first_match_line: matches[0].line_number,
        line_content,
        match_context: clip_text(&match_context, 4000),
        match_count: matches.len(),
    }))
}

fn clip_text(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    let mut clipped = text.chars().take(max_chars).collect::<String>();
    clipped.push_str("...");
    clipped
}

fn escape_json_fragment(text: &str) -> String {
    text.replace('\\', "\\\\").replace('"', "\\\"")
}
