# Custom Configuration Return Transaction [DONE]

## Old Implementation

First-run onboarding and ordinary settings share the same model configuration route. Creating or selecting a configuration only changes the page's local state and does not bind to the chat feature; asynchronous saving when the page is destroyed also cannot guarantee persistence before returning.

## Change Scope

- Add a model configuration route used only for first-run onboarding
- Register unified asynchronous return handling for the current route instance
- Refresh the latest form state and check the selected configuration before returning
- Bind a valid configuration to `FunctionType.CHAT`
- When saving, validation, or binding fails, block exiting and show an error

## Completion Criteria

Top back, system back, and back gestures all leave the page only after saving and binding succeed; the ordinary model configuration route does not change the feature binding.
