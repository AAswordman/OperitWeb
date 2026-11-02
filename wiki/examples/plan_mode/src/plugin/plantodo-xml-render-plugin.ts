import PlantodoScreen from "../ui/plantodo/index.ui.js";
import { XML_TAG } from "../shared/plan_mode_constants.js";

export function onPlantodoXmlRender(
  event: ToolPkg.XmlRenderHookEvent
): ToolPkg.XmlRenderHookObjectResult {
  const payload = event.eventPayload;
  const tagName = payload.tagName;
  if (tagName !== XML_TAG) {
    return { handled: false };
  }
  const xmlContent = payload.xmlContent;
  if (xmlContent === undefined) {
    return { handled: false };
  }
  return {
    handled: true,
    composeDsl: {
      screen: PlantodoScreen,
      state: {
        xmlContent,
      },
      memo: {},
    },
  };
}
