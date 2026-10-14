# Markup

Everything in a `.solid` file outside `<script>` and `<style>` is markup. Markup is JSX, with a shorter syntax for attribute values and a few additions.

## Attribute values

| Write                    | Compiles to                | Notes                                     |
| ------------------------ | -------------------------- | ----------------------------------------- |
| `onClick=increment`      | `onClick={increment}`      | Identifiers need no braces.               |
| `value=props.label`      | `value={props.label}`      | Dotted names also need no braces.         |
| `tabIndex=0`             | `tabIndex={0}`             | Numbers.                                  |
| `disabled=false`         | `disabled={false}`         | `true`, `false` and `null`.               |
| `href=(base + path)`     | `href={(base + path)}`     | Any other expression goes in parentheses. |
| ``id=`item-${id}` ``     | ``id={`item-${id}`}``      | Template literals.                        |
| `items=[1, 2]`           | `items={[1, 2]}`           | Array literals.                           |
| `pattern=/a+/g`          | `pattern={/a+/g}`          | Regular expressions.                      |
| `style={ color: 'red' }` | `style={{ color: 'red' }}` | Braces hold an object literal.            |
| `icon=<Icon />`          | `icon=<Icon />`            | Elements, as in JSX.                      |
| `title="Hello"`          | `title="Hello"`            | Strings, as in JSX.                       |

A bare value ends at whitespace, `/` or `>`. Anything else needs parentheses. `onClick=props.onClick()` is a syntax error. Write `onClick=(props.onClick())` instead.

> [!IMPORTANT]
> Braces in an attribute value are an object literal, not an expression. `value={count}` passes the object `{ count }`, not the value of `count`. Write `value=count` or `value=(count)` for the value.

## Shorthands

| Write          | Compiles to              |
| -------------- | ------------------------ |
| `{href}`       | `href={href}`            |
| `(href)`       | `href={href}`            |
| `{...props}`   | `{...props}`             |
| `[name]=value` | `{...{ [name]: value }}` |
| `[name]`       | `{...{ [name]: true }}`  |

`{name}` and `(name)` only accept an identifier. `[name]` sets an attribute whose name is computed when the element renders.

```html
<a {href} (title) class="link">Open</a>
<input [ariaAttribute]=label [dataAttribute]>
```

## Attribute names

Names can contain `-` and one `:` namespace, as in JSX:

```html
<div aria-label="Close" class:active=(selected) use:tooltip="Hello" />
```

Attributes must be separated by whitespace. `<a title="a"href="b">` is a syntax error.

## Elements

- Lowercase names, such as `<div>` and `<my-element>`, are native elements. Scoped styles apply to them.
- Other names, such as `<Button>` and `<Form.Field>`, are components.
- `<>` and `</>` are fragments.
- `<solid:show>`, `<solid:for>` and the other `solid:` names are the Solid components `Show`, `For` and so on. See [Reactivity](./reactivity.md#components).

Void elements do not need `/>`: `area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `source`, `track` and `wbr`.

```html
<label>Name <input value=name></label>
<br>
```

Every other element needs a closing tag or `/>`.

## Children

Text and elements are written as in JSX. `{expression}` inserts a value:

```html
<p>Hello {user.name}, you have {count} messages.</p>
```

JSX inside expressions uses the same attribute syntax:

```html
<ul>{items.map((item) => <li key=item.id>{item.name}</li>)}</ul>
```

For lists and conditions, [control flow blocks](./control-flow.md) are usually shorter:

```html
<ul>
  #for (item of items) {
    <li>{item.name}</li>
  }
</ul>
```

## Comments

HTML comments are removed from the output:

```html
<!-- This comment is not rendered. -->
<p>Hello</p>
```

## Syntax errors

Errors point at the line and column in the `.solid` file, for example `Wrap this attribute value in parentheses (App.solid:4:17)`. Common ones:

| Message                                          | Cause                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `Wrap this attribute value in parentheses`       | A bare value contains something other than a name or a number, such as a call. |
| `Expected whitespace between attributes`         | Two attributes touch, as in `a="1"b="2"`.                                      |
| `Expected a spread or a shorthand attribute`     | `{...}` in a tag holds neither a spread nor an identifier.                     |
| `Expected </div>`                                | A closing tag does not match its opening tag.                                  |
| `Unexpected end of file, expected a closing tag` | An element is never closed.                                                    |
