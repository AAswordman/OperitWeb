# API Documentation: `ui.d.ts`

`ui.d.ts` describes two layers of UI capability:

- `Tools.UI`: Directly performs actions such as taps, input, and swipes.
- `UINode`: Wraps the page structure into a searchable, traversable, interactive object model.

## Runtime Entry Points

```ts
Tools.UI
UINode
```

`UINode` is also a global class and can be used directly.

## The `Tools.UI` Namespace

### Page reading

#### `getPageInfo()`

Gets the current page information and returns `UIPageResultData`.

### Direct actions

#### `tap(x, y)`

Taps at coordinates.

#### `longPress(x, y)`

Long-presses at coordinates.

#### `setText(text, resourceId?)`

Sets text into an input field; if `resourceId` is given, it attempts to locate the corresponding input field.

#### `pressKey(keyCode)`

Fires a key event.

#### `swipe(startX, startY, endX, endY, duration?)`

Performs a swipe.

### Element clicks: `clickElement(...)`

This method has multiple overloads and is the most complex set of definitions in `ui.d.ts`.

Supported call forms include:

```ts
clickElement(resourceId)
clickElement(bounds)
clickElement(resourceId, index)
clickElement(type, value)
clickElement(type, value, index)
clickElement({ resourceId?, className?, text?, contentDesc?, bounds?, index?, partialMatch?, isClickable? })
```

Where:

- `bounds` has the format `"[x1,y1][x2,y2]"`
- `type` can be `resourceId | className | bounds`
- The object parameter supports lookup by combining multiple attributes

### Sub-agents

#### `runSubAgent(intent, maxSteps?, agentId?, targetApp?)`

```ts
runSubAgent(intent: string, maxSteps?: number, agentId?: string, targetApp?: string): Promise<AutomationExecutionResultData>
```

Suitable for driving UI automation with a high-level goal description.

## The `UINode` Class

### Ways to create one

There are usually two:

```ts
const root = await UINode.getCurrentPage();
```

Or:

```ts
const page = await Tools.UI.getPageInfo();
const root = UINode.fromPageInfo(page);
```

### Common read-only properties

- `className`
- `text`
- `contentDesc`
- `resourceId`
- `bounds`
- `isClickable`
- `rawNode`
- `parent`
- `path`
- `centerPoint`
- `children`
- `childCount`

### Text extraction

- `allTexts(trim?, skipEmpty?)`
- `textContent(separator?)`
- `hasText(text, caseSensitive?)`

### Search methods

- `find(criteria, deep?)`
- `findAll(criteria, deep?)`
- `findByText(text, options?)`
- `findAllByText(text, options?)`
- `findById(id, options?)`
- `findAllById(id, options?)`
- `findByClass(className, options?)`
- `findAllByClass(className, options?)`
- `findByContentDesc(description, options?)`
- `findAllByContentDesc(description, options?)`
- `findClickable()`
- `closest(criteria)`

### Action methods

- `click()`
- `longPress()`
- `setText(text)`
- `wait(ms?)`
- `clickAndWait(ms?)`
- `longPressAndWait(ms?)`

Here `wait()` / `clickAndWait()` / `longPressAndWait()` return the updated `UINode` page state.

### Utility methods

- `toString()`
- `toTree(indent?)`
- `toTreeString(indent?)`
- `toFormattedString?()`
- `equals(other)`

### Static methods

- `fromPageInfo(pageInfo)`
- `getCurrentPage()`
- `findAndWait(query, delayMs?)`
- `clickAndWait(query, delayMs?)`
- `longPressAndWait(query, delayMs?)`

## Examples

### Read the current page and find text

```ts
const root = await UINode.getCurrentPage();
const button = root.findByText('确定');
if (button) {
  await button.click();
}
```

### Using the object form of `clickElement`

```ts
await Tools.UI.clickElement({
  text: '登录',
  partialMatch: false,
  isClickable: true
});
```

### Setting input field text

```ts
await Tools.UI.setText('hello world', 'com.example:id/input');
```

### Calling a UI sub-agent

```ts
const result = await Tools.UI.runSubAgent(
  '打开系统设置并进入 WLAN 页面',
  20,
  undefined,
  'com.android.settings'
);
complete(result);
```

## Related Files

- `examples/types/ui.d.ts`
- `examples/types/results.d.ts`
- `docs/doc-src/package-dev/results.md`
