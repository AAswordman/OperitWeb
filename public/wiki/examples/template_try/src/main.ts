export function registerToolPkg() {
  ToolPkg.registerAppLifecycleHook({
    id: "template_try_app_create",
    event: "application_on_create",
    function: onApplicationCreate,
  });

  return true;
}

export function onApplicationCreate() {
  return { ok: true };
}
