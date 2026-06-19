(function initRecorder(globalScope) {
  class Recorder {
    constructor() {
      this.isRecording = false;
    }

    start() {
      this.isRecording = true;
    }

    stop() {
      this.isRecording = false;
    }

    static _selectorBuilder() {
      if (typeof WebMaticSelectorBuilder !== "undefined") return WebMaticSelectorBuilder;
      if (globalScope && globalScope.WebMaticSelectorBuilder) return globalScope.WebMaticSelectorBuilder;
      if (typeof require === "function") {
        try { return require("../../common/selectors/selector-builder.js"); } catch (_e) { /* ignore */ }
      }
      throw new Error("WebMaticSelectorBuilder no está disponible");
    }

    static escapeAttr(value) {
      return Recorder._selectorBuilder().escapeAttr(value);
    }

    static escapeCssIdent(value) {
      return Recorder._selectorBuilder().escapeCssIdent(value);
    }

    static _normalizeText(value) {
      return Recorder._selectorBuilder().normalizeText(value);
    }

    static _resolveSelectorInDoc(doc, selector) {
      return Recorder._selectorBuilder().resolveSelectorInDoc(doc, selector);
    }

    static selectorResolvesToElement(doc, selector, element, opts) {
      return Recorder._selectorBuilder().selectorResolvesToElement(doc, selector, element, opts);
    }

    static isLikelyDynamicValue(value) {
      return Recorder._selectorBuilder().isLikelyDynamicValue(value);
    }

    static buildSelector(element) {
      return Recorder._selectorBuilder().buildSelector(element);
    }

    static _recordingNormalizer() {
      if (typeof WebMaticRecordingNormalizer !== "undefined") return WebMaticRecordingNormalizer;
      if (globalScope && globalScope.WebMaticRecordingNormalizer) return globalScope.WebMaticRecordingNormalizer;
      if (typeof require === "function") {
        try { return require("./normalizer/recording-normalizer.js"); } catch (_e) { /* ignore */ }
      }
      throw new Error("WebMaticRecordingNormalizer no está disponible");
    }

    static mergeKeySteps(steps) {
      return Recorder._recordingNormalizer().mergeKeySteps(steps);
    }

    static normalizeRecordedSteps(steps) {
      return Recorder._recordingNormalizer().normalizeRecordedSteps(steps);
    }

    static dedupeFieldRuns(steps) {
      return Recorder._recordingNormalizer().dedupeFieldRuns(steps);
    }

    static _defaultsCapture() {
      if (typeof WebMaticDefaultsCapture !== "undefined") return WebMaticDefaultsCapture;
      if (globalScope && globalScope.WebMaticDefaultsCapture) return globalScope.WebMaticDefaultsCapture;
      if (typeof require === "function") {
        try { return require("./defaults/defaults-capture.js"); } catch (_e) { /* ignore */ }
      }
      throw new Error("WebMaticDefaultsCapture no está disponible");
    }

    static isSensitivePreRunField(el) {
      return Recorder._defaultsCapture().isSensitivePreRunField(el);
    }

    static capturePreRunControlsInDoc(doc, out, seen, buildSelector) {
      const select = typeof buildSelector === "function" ? buildSelector : Recorder.buildSelector;
      return Recorder._defaultsCapture().capturePreRunControlsInDoc(doc, out, seen, select);
    }

    static captureInitialPreRunReset(doc, locationHref, title, buildSelector) {
      const select = typeof buildSelector === "function" ? buildSelector : Recorder.buildSelector;
      return Recorder._defaultsCapture().captureInitialPreRunReset(doc, locationHref, title, select);
    }
  }

  globalScope.WebMaticRecorder = Recorder;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Recorder;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
