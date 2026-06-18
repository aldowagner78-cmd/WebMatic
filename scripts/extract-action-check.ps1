$ErrorActionPreference = "Stop"

$ActionCheckPath = "src\modules\player\actions\action-check.js"
$PlayerPath = "src\modules\player\player.js"
$ManifestPath = "manifest.json"

$js = @(
"(function initActionCheck(globalScope) {",
"  function allDocs(rootDoc) {",
"    const docs = [];",
"",
"    function walk(doc) {",
"      if (!doc) return;",
"      docs.push(doc);",
"",
"      try {",
"        const frames = doc.querySelectorAll(""iframe, frame"");",
"        for (const frame of frames) {",
"          try {",
"            const innerDoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);",
"            if (innerDoc) walk(innerDoc);",
"          } catch (e) { /* cross-origin */ }",
"        }",
"      } catch (e) { /* ignore */ }",
"    }",
"",
"    walk(rootDoc || (typeof document !== ""undefined"" ? document : null));",
"    return docs;",
"  }",
"",
"  function findAssociatedCheckInput(el) {",
"    if (!el || !(el instanceof Element)) return null;",
"",
"    if (el instanceof HTMLInputElement) {",
"      const t = (el.type || """").toLowerCase();",
"      if (t === ""checkbox"" || t === ""radio"") return el;",
"    }",
"",
"    try {",
"      const nested = el.querySelector && el.querySelector('input[type=""checkbox""], input[type=""radio""]');",
"      if (nested instanceof HTMLInputElement) return nested;",
"    } catch (e) { /* ignore */ }",
"",
"    try {",
"      const lbl = el instanceof HTMLLabelElement ? el : (el.closest && el.closest(""label[for]""));",
"      if (lbl && lbl.htmlFor) {",
"        const doc = el.ownerDocument || document;",
"        const linked = doc.getElementById(lbl.htmlFor);",
"        if (linked instanceof HTMLInputElement) {",
"          const t = (linked.type || """").toLowerCase();",
"          if (t === ""checkbox"" || t === ""radio"") return linked;",
"        }",
"      }",
"    } catch (e) { /* ignore */ }",
"",
"    return null;",
"  }",
"",
"  function findCheckActivator(inputEl, opts) {",
"    const options = opts && typeof opts === ""object"" ? opts : {};",
"    const isInteractable = options.isInteractable;",
"",
"    if (!(inputEl instanceof HTMLInputElement)) return null;",
"",
"    try {",
"      if (inputEl.labels && inputEl.labels.length) {",
"        const visibleLabel = Array.from(inputEl.labels).find((l) => isInteractable && isInteractable(l));",
"        if (visibleLabel) return visibleLabel;",
"        if (inputEl.labels[0]) return inputEl.labels[0];",
"      }",
"    } catch (e) { /* ignore */ }",
"",
"    if (inputEl.id) {",
"      try {",
"        const doc = inputEl.ownerDocument || document;",
"        const escapedId = String(inputEl.id).replace(/\\/g, ""\\\\"").replace(/""/g, '\\""');",
"        const labels = doc.querySelectorAll(`label[for=""${escapedId}""]`);",
"",
"        for (const lbl of labels) {",
"          if (isInteractable && isInteractable(lbl)) return lbl;",
"        }",
"",
"        if (labels.length > 0) return labels[0];",
"      } catch (e) { /* ignore */ }",
"    }",
"",
"    try {",
"      const roleWrap = inputEl.closest('[role=""radio""], [role=""checkbox""], label');",
"      if (roleWrap && roleWrap !== inputEl) return roleWrap;",
"    } catch (e) { /* ignore */ }",
"",
"    return null;",
"  }",
"",
"  function setCheckedNative(inputEl, desired) {",
"    try {",
"      const proto = Object.getPrototypeOf(inputEl) || HTMLInputElement.prototype;",
"      const desc = Object.getOwnPropertyDescriptor(proto, ""checked"");",
"",
"      if (desc && typeof desc.set === ""function"") {",
"        desc.set.call(inputEl, Boolean(desired));",
"      } else {",
"        inputEl.checked = Boolean(desired);",
"      }",
"    } catch (e) {",
"      inputEl.checked = Boolean(desired);",
"    }",
"",
"    inputEl.dispatchEvent(new Event(""input"", { bubbles: true }));",
"    inputEl.dispatchEvent(new Event(""change"", { bubbles: true }));",
"  }",
"",
"  function findBestCheckTarget(selector, opts) {",
"    const options = opts && typeof opts === ""object"" ? opts : {};",
"    const doc = options.document || (typeof document !== ""undefined"" ? document : null);",
"    const findElement = options.findElement;",
"    const isInteractable = options.isInteractable;",
"",
"    if (!selector || !doc) return null;",
"",
"    if (selector.startsWith(""/"") || selector.startsWith(""("") || /^\w+\[text=""/.test(selector)) {",
"      return findElement ? findElement(selector) : null;",
"    }",
"",
"    const matches = [];",
"",
"    for (const d of allDocs(doc)) {",
"      try {",
"        const list = d.querySelectorAll(selector);",
"        for (const el of list) {",
"          if (!(el instanceof HTMLInputElement)) continue;",
"",
"          const t = (el.type || """").toLowerCase();",
"          if (t !== ""checkbox"" && t !== ""radio"") continue;",
"",
"          matches.push(el);",
"        }",
"      } catch (e) { /* invalid selector */ }",
"    }",
"",
"    if (matches.length === 0) {",
"      const direct = findElement ? findElement(selector) : null;",
"      const associated = findAssociatedCheckInput(direct);",
"      return associated || direct;",
"    }",
"",
"    const interactable = matches.find((el) => isInteractable && isInteractable(el));",
"    return interactable || matches[0];",
"  }",
"",
"  const api = {",
"    allDocs,",
"    findBestCheckTarget,",
"    findAssociatedCheckInput,",
"    findCheckActivator,",
"    setCheckedNative",
"  };",
"",
"  globalScope.WebMaticActionCheck = api;",
"",
"  if (typeof module !== ""undefined"" && module.exports) {",
"    module.exports = api;",
"  }",
"})(typeof globalThis !== ""undefined"" ? globalThis : window);"
)

Set-Content -Path $ActionCheckPath -Value $js -Encoding UTF8

$lines = Get-Content $ManifestPath

if (-not ($lines | Where-Object { $_ -match 'src/modules/player/actions/action-check\.js' })) {
  $newLines = @()

  foreach ($line in $lines) {
    if ($line -match '"src/modules/player/player\.js"') {
      $newLines += '        "src/modules/player/actions/action-check.js",'
    }
    $newLines += $line
  }

  Set-Content -Path $ManifestPath -Value $newLines -Encoding UTF8
}

$player = Get-Content $PlayerPath -Raw

if ($player -notmatch 'function _actionCheck\(\)') {
  $player = $player -replace '  function _allDocs\(rootDoc\) \{', "  function _actionCheck() {`r`n    if (typeof WebMaticActionCheck !== ""undefined"") return WebMaticActionCheck;`r`n    if (globalScope && globalScope.WebMaticActionCheck) return globalScope.WebMaticActionCheck;`r`n    if (typeof require === ""function"") {`r`n      try { return require(""./actions/action-check.js""); } catch (_e) { /* ignore */ }`r`n    }`r`n    throw new Error(""WebMaticActionCheck no esta disponible"");`r`n  }`r`n`r`n  function _allDocs(rootDoc) {"
}

function Replace-Once($Text, $Pattern, $Replacement, $Name) {
  $matches = [regex]::Matches($Text, $Pattern)
  if ($matches.Count -ne 1) {
    throw "Error reemplazando $Name. Coincidencias: $($matches.Count)"
  }
  return [regex]::Replace($Text, $Pattern, $Replacement, 1)
}

$player = Replace-Once $player '(?s)  function _allDocs\(rootDoc\) \{.*?\r?\n  function findBestCheckTarget\(selector\) \{' "  function _allDocs(rootDoc) {`r`n    return _actionCheck().allDocs(rootDoc || document);`r`n  }`r`n`r`n  function findBestCheckTarget(selector) {" "_allDocs"

$player = Replace-Once $player '(?s)  function findBestCheckTarget\(selector\) \{.*?\r?\n  function _resolveLegacyDescendantFallback\(step, selector\) \{' "  function findBestCheckTarget(selector) {`r`n    return _actionCheck().findBestCheckTarget(selector, {`r`n      document,`r`n      findElement,`r`n      isInteractable: _isInteractable`r`n    });`r`n  }`r`n`r`n  function _resolveLegacyDescendantFallback(step, selector) {" "findBestCheckTarget"

$player = Replace-Once $player '(?s)  function _findAssociatedCheckInput\(el\) \{.*?\r?\n  function _findCheckActivator\(inputEl\) \{' "  function _findAssociatedCheckInput(el) {`r`n    return _actionCheck().findAssociatedCheckInput(el);`r`n  }`r`n`r`n  function _findCheckActivator(inputEl) {" "_findAssociatedCheckInput"

$player = Replace-Once $player '(?s)  function _findCheckActivator\(inputEl\) \{.*?\r?\n  function _setCheckedNative\(inputEl, desired\) \{' "  function _findCheckActivator(inputEl) {`r`n    return _actionCheck().findCheckActivator(inputEl, {`r`n      isInteractable: _isInteractable`r`n    });`r`n  }`r`n`r`n  function _setCheckedNative(inputEl, desired) {" "_findCheckActivator"

$player = Replace-Once $player '(?s)  function _setCheckedNative\(inputEl, desired\) \{.*?\r?\n  /\*\*\s*\r?\n   \* Simulates a click' "  function _setCheckedNative(inputEl, desired) {`r`n    return _actionCheck().setCheckedNative(inputEl, desired);`r`n  }`r`n`r`n  /**`r`n   * Simulates a click" "_setCheckedNative"

Set-Content -Path $PlayerPath -Value $player -Encoding UTF8

node -c .\src\modules\player\actions\action-check.js
node -c .\src\modules\player\player.js

npm test