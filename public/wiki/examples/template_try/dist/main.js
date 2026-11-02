"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerToolPkg = registerToolPkg;
exports.onApplicationCreate = onApplicationCreate;
function registerToolPkg() {
    ToolPkg.registerAppLifecycleHook({
        id: "template_try_app_create",
        event: "application_on_create",
        function: onApplicationCreate,
    });
    return true;
}
function onApplicationCreate() {
    return { ok: true };
}
