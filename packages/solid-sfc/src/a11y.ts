/**
 * Accessibility checks on the native elements of the markup. Each problem is
 * a warning with a code, which a `<!-- solid-sfc-ignore code -->` comment
 * before the element turns off.
 */
import { createWarning } from './error.ts';
import type { SFCWarning } from './error.ts';
import type { ElementInfo } from './template.ts';

// The attributes of WAI-ARIA 1.2.
const ARIA_ATTRIBUTES = new Set(
  [
    'activedescendant',
    'atomic',
    'autocomplete',
    'braillelabel',
    'brailleroledescription',
    'busy',
    'checked',
    'colcount',
    'colindex',
    'colindextext',
    'colspan',
    'controls',
    'current',
    'describedby',
    'description',
    'details',
    'disabled',
    'dropeffect',
    'errormessage',
    'expanded',
    'flowto',
    'grabbed',
    'haspopup',
    'hidden',
    'invalid',
    'keyshortcuts',
    'label',
    'labelledby',
    'level',
    'live',
    'modal',
    'multiline',
    'multiselectable',
    'orientation',
    'owns',
    'placeholder',
    'posinset',
    'pressed',
    'readonly',
    'relevant',
    'required',
    'roledescription',
    'rowcount',
    'rowindex',
    'rowindextext',
    'rowspan',
    'selected',
    'setsize',
    'sort',
    'valuemax',
    'valuemin',
    'valuenow',
    'valuetext',
  ].map((name) => `aria-${name}`),
);

// The roles of WAI-ARIA 1.2. `doc-` and `graphics-` roles are also allowed.
const ROLES = new Set([
  'alert',
  'alertdialog',
  'application',
  'article',
  'banner',
  'blockquote',
  'button',
  'caption',
  'cell',
  'checkbox',
  'code',
  'columnheader',
  'combobox',
  'comment',
  'complementary',
  'contentinfo',
  'definition',
  'deletion',
  'dialog',
  'directory',
  'document',
  'emphasis',
  'feed',
  'figure',
  'form',
  'generic',
  'grid',
  'gridcell',
  'group',
  'heading',
  'img',
  'image',
  'insertion',
  'link',
  'list',
  'listbox',
  'listitem',
  'log',
  'main',
  'mark',
  'marquee',
  'math',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'meter',
  'navigation',
  'none',
  'note',
  'option',
  'paragraph',
  'presentation',
  'progressbar',
  'radio',
  'radiogroup',
  'region',
  'row',
  'rowgroup',
  'rowheader',
  'scrollbar',
  'search',
  'searchbox',
  'separator',
  'slider',
  'spinbutton',
  'status',
  'strong',
  'subscript',
  'suggestion',
  'superscript',
  'switch',
  'tab',
  'table',
  'tablist',
  'tabpanel',
  'term',
  'textbox',
  'time',
  'timer',
  'toolbar',
  'tooltip',
  'tree',
  'treegrid',
  'treeitem',
]);

// Roles that users act on, so the keyboard must reach them.
const INTERACTIVE_ROLES = new Set([
  'button',
  'checkbox',
  'combobox',
  'gridcell',
  'link',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'textbox',
  'treeitem',
]);

const INTERACTIVE_ELEMENTS = new Set([
  'a',
  'button',
  'details',
  'embed',
  'iframe',
  'input',
  'label',
  'option',
  'select',
  'summary',
  'textarea',
]);

const KEY_HANDLERS = ['onkeydown', 'onkeyup', 'onkeypress'];

/** The attributes of an element, with lowercase names. */
function lowercase(element: ElementInfo): Map<string, string | true | null> {
  return new Map([...element.attributes].map(([name, value]) => [name.toLowerCase(), value]));
}

function isInteractive(element: ElementInfo, attributes: Map<string, unknown>): boolean {
  if (element.tag === 'input') {
    return attributes.get('type') !== 'hidden';
  }
  if (element.tag === 'a') {
    return attributes.has('href');
  }
  return INTERACTIVE_ELEMENTS.has(element.tag);
}

export function checkAccessibility(source: string, elements: ElementInfo[]): SFCWarning[] {
  const warnings: SFCWarning[] = [];
  for (const element of elements) {
    const attributes = lowercase(element);
    const warn = (code: string, message: string): void => {
      if (!element.ignores.has(code)) {
        warnings.push(createWarning(code, message, source, element.offset, element.tag.length + 1));
      }
    };
    const has = (name: string): boolean => element.spread || attributes.has(name);
    const hidden = attributes.get('aria-hidden') === 'true';
    const role = attributes.get('role');

    if (element.tag === 'img' && !has('alt')) {
      warn('a11y-missing-alt', '<img> needs an alt attribute. Use alt="" for a decorative image');
    }
    if (element.tag === 'iframe' && !has('title')) {
      warn('a11y-missing-title', '<iframe> needs a title that describes its content');
    }
    if (element.tag === 'a' && !has('href')) {
      warn('a11y-missing-href', '<a> needs an href. Use a <button> for an action');
    }
    if (
      attributes.has('onclick') &&
      !hidden &&
      !isInteractive(element, attributes) &&
      !KEY_HANDLERS.some(has)
    ) {
      warn(
        'a11y-click-events',
        `<${element.tag}> with onClick needs a keyboard handler, such as onKeyDown. A <button> handles both`,
      );
    }
    if (
      typeof role === 'string' &&
      INTERACTIVE_ROLES.has(role) &&
      !isInteractive(element, attributes) &&
      !has('tabindex')
    ) {
      warn(
        'a11y-interactive-focus',
        `<${element.tag}> with role="${role}" needs tabIndex, so the keyboard can reach it`,
      );
    }
    if (typeof role === 'string') {
      for (const name of role.split(/\s+/)) {
        if (name && !ROLES.has(name) && !name.startsWith('doc-') && !name.startsWith('graphics-')) {
          warn('a11y-unknown-role', `Unknown ARIA role "${name}"`);
        }
      }
    }
    for (const name of attributes.keys()) {
      if (name.startsWith('aria-') && !ARIA_ATTRIBUTES.has(name)) {
        warn('a11y-unknown-aria', `Unknown ARIA attribute "${name}"`);
      }
    }
    const tabIndex = attributes.get('tabindex');
    if (typeof tabIndex === 'string' && Number(tabIndex) > 0) {
      warn(
        'a11y-positive-tabindex',
        'Avoid a tabIndex above 0. It changes the order in which the keyboard reaches elements',
      );
    }
    if (attributes.has('accesskey')) {
      warn(
        'a11y-accesskey',
        'Avoid accessKey. Its shortcuts can conflict with assistive technology',
      );
    }
    if (attributes.has('autofocus')) {
      warn('a11y-autofocus', 'Avoid autofocus. It moves the focus without warning');
    }
  }
  return warnings;
}
