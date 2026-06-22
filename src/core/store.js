(function initStore(globalScope) {
  const fallbackContracts = {
    ActionTypes: {
      PANEL_TOGGLED: "PANEL_TOGGLED",
      PANEL_SIDE_SET: "PANEL_SIDE_SET",
      PANEL_SIDE_TOGGLED: "PANEL_SIDE_TOGGLED",
      PANEL_WIDTH_SET: "PANEL_WIDTH_SET",
      MODE_SET: "MODE_SET",
      SETTINGS_UPDATED: "SETTINGS_UPDATED",
      RECORD_STARTED: "RECORD_STARTED",
      RECORD_STOPPED: "RECORD_STOPPED",
      PLAY_STARTED: "PLAY_STARTED",
      PLAY_STOPPED: "PLAY_STOPPED",
      STEP_CAPTURED: "STEP_CAPTURED",
      DRAFT_RESTORED: "DRAFT_RESTORED",
      STATUS_MESSAGE_SET: "STATUS_MESSAGE_SET",
      LIBRARY_LOADED: "LIBRARY_LOADED",
      MACRO_SAVED: "MACRO_SAVED",
      LIBRARY_FILTERED: "LIBRARY_FILTERED",
      LIBRARY_SELECTED: "LIBRARY_SELECTED",
      MACRO_RENAMED: "MACRO_RENAMED",
      MACRO_DELETED: "MACRO_DELETED",
      PLAYBACK_REPEAT_SET: "PLAYBACK_REPEAT_SET",
      PLAYBACK_LOOP_TOGGLED: "PLAYBACK_LOOP_TOGGLED",
      PLAYBACK_STEP_STARTED: "PLAYBACK_STEP_STARTED",
      PLAYBACK_ERROR: "PLAYBACK_ERROR",
      PANEL_SHOWN: "PANEL_SHOWN",
      SAVE_MODAL_OPENED: "SAVE_MODAL_OPENED",
      SAVE_MODAL_CLOSED: "SAVE_MODAL_CLOSED",
      SCRIPT_EDITOR_OPENED: "SCRIPT_EDITOR_OPENED",
      SCRIPT_EDITOR_CLOSED: "SCRIPT_EDITOR_CLOSED"
    },
    Modes: {
      RECORD: "record",
      PLAY: "play",
      SETTINGS: "settings"
    },
    PanelSides: {
      LEFT: "left",
      RIGHT: "right"
    }
  };

  const contracts = globalScope.WebMaticContracts || fallbackContracts;
  const { ActionTypes, Modes, PanelSides } = contracts;

  const defaultState = Object.freeze({
    ui: {
      panelVisible: false,
      panelSide: PanelSides.LEFT,
      panelWidth: 260,
      mode: Modes.PLAY,
      isFloatingRecorderVisible: false,
      saveModal: {
        open: false,
        script: ""
      },
      scriptEditor: {
        open: false,
        script: "",
        macroId: null,
        draftSteps: [],
        meta: null
      }
    },
    playback: {
      speed: 1.5,
      retryCount: 3,
      retryDelayMs: 500,
      isPlaying: false,
      loopEnabled: false,
      repeatCount: 5,
      currentStepIndex: -1,
      currentSteps: [],
      errorMessage: null
    },
    recorder: {
      isRecording: false,
      startedAt: null
    },
    draft: {
      stepsCount: 0,
      steps: []
    },
    library: {
      macros: [],
      selectedMacroId: null,
      searchQuery: ""
    },
    runtime: {
      statusMessage: "Listo",
      playbackStopSummary: null
    },
    settings: {
      theme: "light",
      themeMode: "light",
      themeVariant: 1,
      accentColor: "#059669",
      surfaceColor: "#fffaf3",
      speed: 1.5,
      panelOpacity: 1,
      waitThreshold: 3,
      runtimeDataEnabled: false,
      runtimeDataType: "generic",
      runtimeCustomTypes: [],
      runtimeData: "",
      runtimeDataItems: [],
      runtimeDataTemplates: [],
      runtimeTemplateSelectedId: "",
      pageMetaMaxProfiles: 60
    }
  });

  function reducer(state, action) {
    if (!action || !action.type) {
      return state;
    }

    switch (action.type) {
      case ActionTypes.PANEL_TOGGLED:
        if (state.recorder.isRecording) {
          return state;
        }
        return {
          ...state,
          ui: {
            ...state.ui,
            panelVisible: !state.ui.panelVisible
          }
        };
      case ActionTypes.PANEL_SHOWN:
        return {
          ...state,
          ui: { ...state.ui, panelVisible: true }
        };
      case ActionTypes.PANEL_SIDE_SET:
        return {
          ...state,
          ui: {
            ...state.ui,
            panelSide: action.payload
          }
        };
      case ActionTypes.PANEL_WIDTH_SET:
        return {
          ...state,
          ui: {
            ...state.ui,
            panelWidth: 260
          }
        };
      case ActionTypes.PANEL_SIDE_TOGGLED:
        return {
          ...state,
          ui: {
            ...state.ui,
            panelSide: state.ui.panelSide === PanelSides.LEFT ? PanelSides.RIGHT : PanelSides.LEFT
          }
        };
      case ActionTypes.MODE_SET:
        return {
          ...state,
          ui: {
            ...state.ui,
            mode: action.payload
          }
        };
      case ActionTypes.RECORD_STARTED:
        return {
          ...state,
          recorder: {
            ...state.recorder,
            isRecording: true,
            startedAt: Date.now()
          },
          draft: {
            stepsCount: 0,
            steps: []
          },
          runtime: {
            ...state.runtime,
            statusMessage: "Grabacion iniciada"
          },
          ui: {
            ...state.ui,
            panelVisible: false,
            mode: Modes.RECORD,
            isFloatingRecorderVisible: false
          }
        };
      case ActionTypes.RECORD_STOPPED:
        return {
          ...state,
          recorder: {
            ...state.recorder,
            isRecording: false,
            startedAt: null
          },
          runtime: {
            ...state.runtime,
            statusMessage: state.draft.stepsCount > 0 ? "Grabacion detenida" : "Grabacion detenida sin pasos"
          },
          ui: {
            ...state.ui,
            panelVisible: true,
            mode: Modes.PLAY,
            isFloatingRecorderVisible: false
          }
        };
      case ActionTypes.PLAYBACK_STEP_STARTED:
        return {
          ...state,
          playback: {
            ...state.playback,
            currentStepIndex: action.payload.index,
            currentSteps: action.payload.steps || state.playback.currentSteps
          }
        };
      case ActionTypes.PLAYBACK_ERROR:
        return {
          ...state,
          playback: {
            ...state.playback,
            isPlaying: false,
            errorMessage: action.payload
          }
        };
      case ActionTypes.PLAY_STARTED:
        return {
          ...state,
          playback: {
            ...state.playback,
            isPlaying: true,
            currentStepIndex: -1,
            currentSteps: [],
            errorMessage: null
          },
          runtime: {
            ...state.runtime,
            playbackStopSummary: null,
            statusMessage: "Reproduccion en curso"
          },
          ui: {
            ...state.ui,
            mode: Modes.PLAY,
            panelVisible: false
          }
        };
      case ActionTypes.PLAY_STOPPED:
        return {
          ...state,
          playback: {
            ...state.playback,
            isPlaying: false
            // currentStepIndex and currentSteps preserved so panel shows final state
          },
          runtime: {
            ...state.runtime,
            statusMessage: "Reproduccion detenida"
          }
          // panelVisible is NOT restored here — only when the floating panel is closed
        };
      case ActionTypes.PLAYBACK_STOP_SUMMARY_SET:
        return {
          ...state,
          runtime: {
            ...state.runtime,
            playbackStopSummary: action.payload || null
          }
        };
      case ActionTypes.STEP_CAPTURED:
        if (!action.payload) {
          return state;
        }
        // _merge: true → replace the last step instead of appending (for text keystroke merging)
        if (action.payload._merge && state.draft.steps.length > 0) {
          const { _merge, ...stepData } = action.payload;
          const steps = [...state.draft.steps.slice(0, -1), stepData];
          return {
            ...state,
            draft: { ...state.draft, steps },
            runtime: { ...state.runtime, statusMessage: "Paso capturado" }
          };
        }
        return {
          ...state,
          draft: {
            ...state.draft,
            stepsCount: state.draft.stepsCount + 1,
            steps: [...state.draft.steps, action.payload]
          },
          runtime: {
            ...state.runtime,
            statusMessage: "Paso capturado"
          }
        };
      case ActionTypes.DRAFT_RESTORED: {
        const list = Array.isArray(action.payload) ? action.payload : [];
        return {
          ...state,
          draft: {
            ...state.draft,
            stepsCount: list.length,
            steps: list
          },
          runtime: {
            ...state.runtime,
            statusMessage: list.length > 0 ? "Pasos restaurados" : state.runtime.statusMessage
          }
        };
      }
      case ActionTypes.STATUS_MESSAGE_SET:
        return {
          ...state,
          runtime: {
            ...state.runtime,
            statusMessage: String(action.payload || "")
          }
        };
      case ActionTypes.SETTINGS_UPDATED:
        return {
          ...state,
          settings: {
            ...state.settings,
            ...action.payload
          }
        };
      case ActionTypes.LIBRARY_LOADED:
        return {
          ...state,
          library: {
            ...state.library,
            macros: Array.isArray(action.payload) ? action.payload : state.library.macros
          }
        };
      case ActionTypes.MACRO_SAVED:
        return {
          ...state,
          library: {
            ...state.library,
            macros: [...state.library.macros, action.payload]
          }
        };
      case ActionTypes.LIBRARY_FILTERED:
        return {
          ...state,
          library: {
            ...state.library,
            searchQuery: String(action.payload || "")
          }
        };
      case ActionTypes.LIBRARY_SELECTED:
        return {
          ...state,
          library: {
            ...state.library,
            selectedMacroId: action.payload || null
          }
        };
      case ActionTypes.MACRO_RENAMED:
        return {
          ...state,
          library: {
            ...state.library,
            macros: state.library.macros.map((m) =>
              m.id === action.payload.id ? { ...m, name: action.payload.name } : m
            )
          }
        };
      case ActionTypes.MACRO_DELETED:
        return {
          ...state,
          library: {
            ...state.library,
            macros: state.library.macros.filter((m) => m.id !== action.payload),
            selectedMacroId: state.library.selectedMacroId === action.payload ? null : state.library.selectedMacroId
          }
        };
      case ActionTypes.PLAYBACK_LOOP_TOGGLED:
        return {
          ...state,
          playback: {
            ...state.playback,
            loopEnabled: !state.playback.loopEnabled
          }
        };
      case ActionTypes.PLAYBACK_REPEAT_SET: {
        const raw = Number(action.payload);
        const clamped = Number.isFinite(raw) ? Math.min(100, Math.max(2, Math.round(raw))) : state.playback.repeatCount;
        return {
          ...state,
          playback: { ...state.playback, repeatCount: clamped }
        };
      }
      case ActionTypes.SAVE_MODAL_OPENED:
        return {
          ...state,
          ui: {
            ...state.ui,
            saveModal: { open: true, script: String(action.payload?.script || "") }
          }
        };
      case ActionTypes.SAVE_MODAL_CLOSED:
        return {
          ...state,
          ui: {
            ...state.ui,
            saveModal: { open: false, script: "" }
          }
        };
      case ActionTypes.SCRIPT_EDITOR_OPENED: {
        const editorDraftSteps = Array.isArray(action.payload?.draftSteps) ? action.payload.draftSteps : [];
        const editorScript = String(action.payload?.script || "");
        // Si el script viene vacío pero hay steps, se genera desde los steps en el render
        // (el store solo guarda lo que se recibe; la generación on-demand está en ui-shell.js)
        return {
          ...state,
          ui: {
            ...state.ui,
            scriptEditor: {
              open: true,
              script: editorScript,
              macroId: action.payload?.macroId || null,
              draftSteps: editorDraftSteps,
              meta: (action.payload && typeof action.payload.meta === "object") ? action.payload.meta : null
            }
          }
        };
      }
      case ActionTypes.SCRIPT_EDITOR_CLOSED:
        return {
          ...state,
          ui: {
            ...state.ui,
            scriptEditor: { open: false, script: "", macroId: null, draftSteps: [], meta: null }
          }
        };
      default:
        return state;
    }
  }

  function createStore(initialState) {
    let currentState = initialState || defaultState;
    const listeners = new Set();

    return {
      getState() {
        return currentState;
      },
      dispatch(action) {
        currentState = reducer(currentState, action);
        listeners.forEach((listener) => listener(currentState, action));
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    };
  }

  const storeApi = Object.freeze({
    createStore,
    reducer,
    defaultState
  });

  globalScope.WebMaticStore = storeApi;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = storeApi;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
