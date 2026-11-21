import {
  CameraUnsupportedError,
  CancelledError,
  ClosedError,
  CorruptFileError,
  ERROR_KINDS,
  FlashRawError,
  GpuUnavailableError,
  InternalError,
  InvalidArgumentError,
  InvalidMetadataError,
  IoError,
  LimitExceededError,
  NotAvailableError,
  OutOfMemoryError,
  UnsupportedCompressionError,
  UnsupportedFormatError,
  errorFromJSON,
  errorFromKind,
  serve
} from "./chunks/chunk-7CRYYF6Z.js";
import {
  __export
} from "./chunks/chunk-SEWDMQ6Q.js";

// node_modules/flashraw/dist/browser.js
var browser_exports = {};
__export(browser_exports, {
  BACKENDS: () => BACKENDS,
  CameraUnsupportedError: () => CameraUnsupportedError,
  CancelledError: () => CancelledError,
  ClosedError: () => ClosedError,
  CorruptFileError: () => CorruptFileError,
  DecodedFrame: () => DecodedFrame,
  ERROR_KINDS: () => ERROR_KINDS,
  FlashRaw: () => FlashRaw,
  FlashRawError: () => FlashRawError,
  GPU_OUTPUTS: () => GPU_OUTPUTS,
  GpuFrame: () => GpuFrame,
  GpuUnavailableError: () => GpuUnavailableError,
  InternalError: () => InternalError,
  InvalidArgumentError: () => InvalidArgumentError,
  InvalidMetadataError: () => InvalidMetadataError,
  IoError: () => IoError,
  JPEGXL_MODES: () => JPEGXL_MODES,
  LimitExceededError: () => LimitExceededError,
  NotAvailableError: () => NotAvailableError,
  OUTPUTS: () => OUTPUTS,
  OutOfMemoryError: () => OutOfMemoryError,
  UnsupportedCompressionError: () => UnsupportedCompressionError,
  UnsupportedFormatError: () => UnsupportedFormatError,
  _internals: () => _internals,
  _setDefaults: () => _setDefaults,
  _setPlatform: () => _setPlatform,
  decodeRaw: () => decodeRaw,
  detectFormat: () => detectFormat,
  errorFromJSON: () => errorFromJSON,
  errorFromKind: () => errorFromKind,
  extractPreview: () => extractPreview,
  extractThumbnail: () => extractThumbnail,
  getCapabilities: () => getCapabilities,
  getGpuDevice: () => getGpuDevice,
  init: () => init,
  initThreads: () => initThreads,
  loadJpegXlSupport: () => loadJpegXlSupport,
  readMetadata: () => readMetadata,
  reinit: () => reinit,
  simdSupported: () => simdSupported,
  supportsFile: () => supportsFile
});

// node_modules/flashraw/dist/flashraw_bindgen.js
var flashraw_bindgen_exports = {};
__export(flashraw_bindgen_exports, {
  Frame: () => Frame,
  InputBuffer: () => InputBuffer,
  RawFile: () => RawFile,
  buildInfo: () => buildInfo,
  default: () => __wbg_init,
  detect: () => detect,
  initSync: () => initSync,
  open: () => open,
  start: () => start,
  takeLastPanic: () => takeLastPanic,
  version: () => version
});
var Frame = class _Frame {
  static __wrap(ptr) {
    const obj = Object.create(_Frame.prototype);
    obj.__wbg_ptr = ptr;
    FrameFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    FrameFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_frame_free(ptr, 0);
  }
  /**
   * @returns {string}
   */
  infoJson() {
    let deferred1_0;
    let deferred1_1;
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.frame_infoJson(retptr, this.__wbg_ptr);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      deferred1_0 = r0;
      deferred1_1 = r1;
      return getStringFromWasm0(r0, r1);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
      wasm.__wbindgen_export2(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * Element type: `"u8"`, `"u16"` or `"f32"`.
   * @returns {string}
   */
  get kind() {
    let deferred1_0;
    let deferred1_1;
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.frame_kind(retptr, this.__wbg_ptr);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      deferred1_0 = r0;
      deferred1_1 = r1;
      return getStringFromWasm0(r0, r1);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
      wasm.__wbindgen_export2(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * Number of elements (not bytes).
   * @returns {number}
   */
  get len() {
    const ret = wasm.frame_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Address of the first element (aligned for the element type).
   * @returns {number}
   */
  get ptr() {
    const ret = wasm.frame_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
};
if (Symbol.dispose) Frame.prototype[Symbol.dispose] = Frame.prototype.free;
var InputBuffer = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    InputBufferFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_inputbuffer_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get len() {
    const ret = wasm.inputbuffer_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Allocate `len` bytes (fails with `OutOfMemory` rather than aborting).
   * @param {number} len
   */
  constructor(len) {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.inputbuffer_new(retptr, len);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
      if (r2) {
        throw takeObject(r1);
      }
      this.__wbg_ptr = r0;
      InputBufferFinalization.register(this, this.__wbg_ptr, this);
      return this;
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
   * Address of the buffer in WASM memory.
   * @returns {number}
   */
  get ptr() {
    const ret = wasm.inputbuffer_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Shrink to `len` bytes (when a stream turned out shorter than announced).
   * @param {number} len
   */
  truncate(len) {
    wasm.inputbuffer_truncate(this.__wbg_ptr, len);
  }
};
if (Symbol.dispose) InputBuffer.prototype[Symbol.dispose] = InputBuffer.prototype.free;
var RawFile = class _RawFile {
  static __wrap(ptr) {
    const obj = Object.create(_RawFile.prototype);
    obj.__wbg_ptr = ptr;
    RawFileFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    RawFileFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_rawfile_free(ptr, 0);
  }
  /**
   * @returns {string}
   */
  capabilitiesJson() {
    let deferred1_0;
    let deferred1_1;
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.rawfile_capabilitiesJson(retptr, this.__wbg_ptr);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      deferred1_0 = r0;
      deferred1_1 = r1;
      return getStringFromWasm0(r0, r1);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
      wasm.__wbindgen_export2(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * Decode a preview to RGBA8.
   * @param {string} which
   * @returns {Frame}
   */
  decodePreview(which) {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      const ptr0 = passStringToWasm0(which, wasm.__wbindgen_export3, wasm.__wbindgen_export4);
      const len0 = WASM_VECTOR_LEN;
      wasm.rawfile_decodePreview(retptr, this.__wbg_ptr, ptr0, len0);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
      if (r2) {
        throw takeObject(r1);
      }
      return Frame.__wrap(r0);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
   * @param {number} index
   * @param {string} options_json
   * @returns {Frame}
   */
  decodeTile(index, options_json) {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      const ptr0 = passStringToWasm0(options_json, wasm.__wbindgen_export3, wasm.__wbindgen_export4);
      const len0 = WASM_VECTOR_LEN;
      wasm.rawfile_decodeTile(retptr, this.__wbg_ptr, index, ptr0, len0);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
      if (r2) {
        throw takeObject(r1);
      }
      return Frame.__wrap(r0);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
   * Decode the sensor data. `options_json`: see `npm/src/types.d.ts` (`DecodeOptions`).
   * @param {string} options_json
   * @returns {Frame}
   */
  decode(options_json) {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      const ptr0 = passStringToWasm0(options_json, wasm.__wbindgen_export3, wasm.__wbindgen_export4);
      const len0 = WASM_VECTOR_LEN;
      wasm.rawfile_decode(retptr, this.__wbg_ptr, ptr0, len0);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
      if (r2) {
        throw takeObject(r1);
      }
      return Frame.__wrap(r0);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
   * `[ptr, len]` of the EXIF metadata (a standalone TIFF stream), or `null`. The bytes live
   * as long as this handle.
   * @returns {any}
   */
  exifSpan() {
    const ret = wasm.rawfile_exifSpan(this.__wbg_ptr);
    return takeObject(ret);
  }
  /**
   * @returns {string}
   */
  frameInfoJson() {
    let deferred1_0;
    let deferred1_1;
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.rawfile_frameInfoJson(retptr, this.__wbg_ptr);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      deferred1_0 = r0;
      deferred1_1 = r1;
      return getStringFromWasm0(r0, r1);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
      wasm.__wbindgen_export2(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {number}
   */
  inputLen() {
    const ret = wasm.rawfile_inputLen(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Address and length of the input bytes in WASM memory.
   * @returns {number}
   */
  inputPtr() {
    const ret = wasm.rawfile_inputPtr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {string}
   */
  metadataJson() {
    let deferred1_0;
    let deferred1_1;
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.rawfile_metadataJson(retptr, this.__wbg_ptr);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      deferred1_0 = r0;
      deferred1_1 = r1;
      return getStringFromWasm0(r0, r1);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
      wasm.__wbindgen_export2(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {number}
   */
  parseMs() {
    const ret = wasm.rawfile_parseMs(this.__wbg_ptr);
    return ret;
  }
  /**
   * `[ptr, len]` of an embedded preview (`"largest"`, `"smallest"` or an index) plus its
   * JSON description, as `[ptr, len, json]`.
   * @param {string} which
   * @returns {Array<any>}
   */
  previewSpan(which) {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      const ptr0 = passStringToWasm0(which, wasm.__wbindgen_export3, wasm.__wbindgen_export4);
      const len0 = WASM_VECTOR_LEN;
      wasm.rawfile_previewSpan(retptr, this.__wbg_ptr, ptr0, len0);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
      if (r2) {
        throw takeObject(r1);
      }
      return takeObject(r0);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
   * @returns {string}
   */
  unitsJson() {
    let deferred1_0;
    let deferred1_1;
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.rawfile_unitsJson(retptr, this.__wbg_ptr);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      deferred1_0 = r0;
      deferred1_1 = r1;
      return getStringFromWasm0(r0, r1);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
      wasm.__wbindgen_export2(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * `[ptr, len]` of the XMP packet, or `null`.
   * @returns {any}
   */
  xmpSpan() {
    const ret = wasm.rawfile_xmpSpan(this.__wbg_ptr);
    return takeObject(ret);
  }
};
if (Symbol.dispose) RawFile.prototype[Symbol.dispose] = RawFile.prototype.free;
function buildInfo() {
  let deferred1_0;
  let deferred1_1;
  try {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    wasm.buildInfo(retptr);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    deferred1_0 = r0;
    deferred1_1 = r1;
    return getStringFromWasm0(r0, r1);
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
    wasm.__wbindgen_export2(deferred1_0, deferred1_1, 1);
  }
}
function detect(bytes) {
  try {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export3);
    const len0 = WASM_VECTOR_LEN;
    wasm.detect(retptr, ptr0, len0);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    let v2;
    if (r0 !== 0) {
      v2 = getStringFromWasm0(r0, r1);
      wasm.__wbindgen_export2(r0, r1 * 1, 1);
    }
    return v2;
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
  }
}
function open(input, options_json) {
  try {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    _assertClass(input, InputBuffer);
    var ptr0 = input.__destroy_into_raw();
    const ptr1 = passStringToWasm0(options_json, wasm.__wbindgen_export3, wasm.__wbindgen_export4);
    const len1 = WASM_VECTOR_LEN;
    wasm.open(retptr, ptr0, ptr1, len1);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
    if (r2) {
      throw takeObject(r1);
    }
    return RawFile.__wrap(r0);
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
  }
}
function start() {
  wasm.start();
}
function takeLastPanic() {
  try {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    wasm.takeLastPanic(retptr);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    let v1;
    if (r0 !== 0) {
      v1 = getStringFromWasm0(r0, r1);
      wasm.__wbindgen_export2(r0, r1 * 1, 1);
    }
    return v1;
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
  }
}
function version() {
  let deferred1_0;
  let deferred1_1;
  try {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    wasm.version(retptr);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    deferred1_0 = r0;
    deferred1_1 = r1;
    return getStringFromWasm0(r0, r1);
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
    wasm.__wbindgen_export2(deferred1_0, deferred1_1, 1);
  }
}
function __wbg_get_imports() {
  const import0 = {
    __proto__: null,
    __wbg___flashrawCancelPoll_0d9626e209ba1ff1: function() {
      const ret = globalThis.__flashrawCancelPoll();
      return ret;
    },
    __wbg___wbindgen_throw_41e9ee4f547fc59a: function(arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1));
    },
    __wbg_new_343a093a3c2ffb4e: function(arg0, arg1) {
      const ret = new Error(getStringFromWasm0(arg0, arg1));
      return addHeapObject(ret);
    },
    __wbg_now_1ff37783be147345: function() {
      const ret = performance.now();
      return ret;
    },
    __wbg_of_20798cb14708764f: function(arg0, arg1) {
      const ret = Array.of(getObject(arg0), getObject(arg1));
      return addHeapObject(ret);
    },
    __wbg_of_dde0b9d3265685ee: function(arg0, arg1, arg2) {
      const ret = Array.of(getObject(arg0), getObject(arg1), getObject(arg2));
      return addHeapObject(ret);
    },
    __wbg_parse_0fc53dead14b3b42: function() {
      return handleError(function(arg0, arg1) {
        const ret = JSON.parse(getStringFromWasm0(arg0, arg1));
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_set_145a351398b48c65: function() {
      return handleError(function(arg0, arg1, arg2) {
        const ret = Reflect.set(getObject(arg0), getObject(arg1), getObject(arg2));
        return ret;
      }, arguments);
    },
    __wbindgen_generic_0000000000000001: function(arg0) {
      const ret = arg0;
      return addHeapObject(ret);
    },
    __wbindgen_generic_0000000000000002: function(arg0, arg1) {
      const ret = getStringFromWasm0(arg0, arg1);
      return addHeapObject(ret);
    },
    __wbindgen_object_drop_ref: function(arg0) {
      takeObject(arg0);
    }
  };
  return {
    __proto__: null,
    "./flashraw_bindgen_bg.js": import0
  };
}
var FrameFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_frame_free(ptr, 1));
var InputBufferFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_inputbuffer_free(ptr, 1));
var RawFileFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_rawfile_free(ptr, 1));
function addHeapObject(obj) {
  if (heap_next === heap.length) heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];
  heap[idx] = obj;
  return idx;
}
function _assertClass(instance, klass) {
  if (!(instance instanceof klass)) {
    throw new Error(`expected instance of ${klass.name}`);
  }
}
function dropObject(idx) {
  if (idx < 1028) return;
  heap[idx] = heap_next;
  heap_next = idx;
}
var cachedDataViewMemory0 = null;
function getDataViewMemory0() {
  if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || cachedDataViewMemory0.buffer.detached === void 0 && cachedDataViewMemory0.buffer !== wasm.memory.buffer) {
    cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
  }
  return cachedDataViewMemory0;
}
function getStringFromWasm0(ptr, len) {
  return decodeText(ptr >>> 0, len);
}
var cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}
function getObject(idx) {
  return heap[idx];
}
function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    wasm.__wbindgen_export(addHeapObject(e));
  }
}
var heap = new Array(1024).fill(void 0);
heap.push(void 0, null, true, false);
var heap_next = heap.length;
function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}
function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory0();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127) break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder.encodeInto(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}
function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}
var cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
var MAX_SAFARI_DECODE_BYTES = 2146435072;
var numBytesDecoded = 0;
function decodeText(ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}
var cachedTextEncoder = new TextEncoder();
if (!("encodeInto" in cachedTextEncoder)) {
  cachedTextEncoder.encodeInto = function(arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length
    };
  };
}
var WASM_VECTOR_LEN = 0;
var wasmModule;
var wasmInstance;
var wasm;
function __wbg_finalize_init(instance, module) {
  wasmInstance = instance;
  wasm = instance.exports;
  wasmModule = module;
  cachedDataViewMemory0 = null;
  cachedUint8ArrayMemory0 = null;
  wasm.__wbindgen_start();
  return wasm;
}
async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (!module.ok) {
      throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
    }
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse = expectedResponseType(module.type);
        if (validResponse && module.headers.get("Content-Type") !== "application/wasm") {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
        } else {
          throw e;
        }
      }
    }
    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);
    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
  function expectedResponseType(type) {
    switch (type) {
      case "basic":
      case "cors":
      case "default":
        return true;
    }
    return false;
  }
}
function initSync(module) {
  if (wasm !== void 0) return wasm;
  if (module !== void 0) {
    if (Object.getPrototypeOf(module) === Object.prototype) {
      ({ module } = module);
    } else {
      console.warn("using deprecated parameters for `initSync()`; pass a single object instead");
    }
  }
  const imports = __wbg_get_imports();
  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module);
  }
  const instance = new WebAssembly.Instance(module, imports);
  return __wbg_finalize_init(instance, module);
}
async function __wbg_init(module_or_path) {
  if (wasm !== void 0) return wasm;
  if (module_or_path !== void 0) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn("using deprecated parameters for the initialization function; pass a single object instead");
    }
  }
  const imports = __wbg_get_imports();
  if (typeof module_or_path === "string" || typeof Request === "function" && module_or_path instanceof Request || typeof URL === "function" && module_or_path instanceof URL) {
    module_or_path = fetch(module_or_path);
  }
  const { instance, module } = await __wbg_load(await module_or_path, imports);
  return __wbg_finalize_init(instance, module);
}

// node_modules/flashraw/dist/threads.js
var STARTUP_TIMEOUT_MS = 3e4;
if (typeof globalThis.__flashrawCancelPoll !== "function") {
  globalThis.__flashrawCancelPoll = () => {
    const f = globalThis.__flashrawCancelFlag;
    return f !== void 0 && Atomics.load(f, 0) !== 0;
  };
}
function once(worker, what) {
  return new Promise((resolve, reject) => {
    worker.onMessage((m) => {
      if (m?.type === "ready") resolve();
      else if (m?.type === "error") reject(new InternalError(`${what} failed to start: ${m.message}`));
    });
    worker.onError((e) => reject(new InternalError(`${what} failed to start: ${e?.message ?? e}`, { cause: e })));
  });
}
var ThreadPool = class _ThreadPool {
  #coordinator;
  #workers = [];
  #pending = /* @__PURE__ */ new Map();
  #next = 1;
  #broken = null;
  /** Number of rayon threads (the coordinator is not counted). */
  count = 0;
  /** Bytes the shared memory grew by while the pool started. */
  memoryGrowth = 0;
  constructor(coordinator) {
    this.#coordinator = coordinator;
    this.#add(coordinator);
    this.#listen();
  }
  /**
   * Start the coordinator and `count` thread workers (one per rayon thread), then rayon's
   * global pool. The thread workers load and instantiate while the coordinator starts; each
   * becomes a rayon thread once the coordinator hands it its `ThreadBuilder` pointer.
   * @param {{ spawn: (name: string) => any, module: WebAssembly.Module, memory: WebAssembly.Memory, count: number }} o
   */
  static async start({ spawn, module, memory, count }) {
    let pool = null;
    const workers = [];
    const size0 = memory.buffer.byteLength;
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new InternalError(`FlashRaw threads did not start within ${STARTUP_TIMEOUT_MS / 1e3} s`)),
        STARTUP_TIMEOUT_MS
      );
    });
    try {
      const coordinator = spawn("flashraw-coordinator");
      workers.push(coordinator);
      const ready = once(coordinator, "the FlashRaw coordinator worker");
      coordinator.post({ type: "init", role: "coordinator", module, memory });
      const started = [];
      const idle = [];
      const startThread = () => {
        const i = started.length;
        const w = spawn(`flashraw-thread-${i}`);
        workers.push(w);
        started.push(once(w, `FlashRaw thread ${i}`));
        w.post({ type: "init", role: "thread", module, memory });
        return w;
      };
      for (let i = 0; i < count; i++) idle.push(startThread());
      await Promise.race([ready, timeout]);
      pool = new _ThreadPool(coordinator);
      for (const w of workers.slice(1)) pool.#add(w);
      coordinator.onMessage((m) => {
        if (m?.type !== "spawn") return;
        let w = idle.shift();
        if (!w) {
          w = startThread();
          pool.#add(w);
        }
        w.post({ type: "run", ptr: m.ptr });
      });
      pool.count = await Promise.race([pool.call("build", { count }), timeout]);
      await Promise.race([Promise.all(started), timeout]);
      for (const w of idle) w.terminate();
      pool.memoryGrowth = memory.buffer.byteLength - size0;
      return pool;
    } catch (e) {
      for (const w of workers) {
        try {
          w.terminate();
        } catch {
        }
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  #add(w) {
    this.#workers.push(w);
    w.onMessage((m) => {
      if (m?.type === "trap") {
        this.#poison(new InternalError(`FlashRaw WASM thread trapped: ${m.panic ? `panic: ${m.panic}` : m.message}`));
      }
    });
    w.onError((e) => this.#poison(new InternalError(`FlashRaw thread failed: ${e?.message ?? e}`, { cause: e })));
  }
  #listen() {
    this.#coordinator.onMessage((m) => {
      if (m?.type !== "result") return;
      const p = this.#pending.get(m.id);
      if (!p) return;
      this.#pending.delete(m.id);
      if (this.#pending.size === 0) this.#coordinator.idle?.(true);
      if (m.err) {
        const e = m.err;
        p.reject(
          e.trap ? new InternalError(`FlashRaw WASM trap: ${e.panic ? `panic: ${e.panic}` : `${e.message} (likely out of memory)`}`) : errorFromKind(e.kind ?? "Internal", e.message ?? "unknown error", e.corrupt ? { corrupt: e.corrupt } : void 0)
        );
      } else {
        p.resolve(m.ok);
      }
    });
  }
  #poison(err) {
    if (this.#broken) return;
    this.#broken = err;
    for (const p of this.#pending.values()) p.reject(err);
    this.#pending.clear();
    this.terminate();
  }
  /** Error that made the pool unusable, or null. */
  get broken() {
    return this.#broken;
  }
  /** Run a job on the coordinator. Resolves to the pointer/number the job returns. */
  call(op, args) {
    if (this.#broken) return Promise.reject(this.#broken);
    const id = this.#next++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      if (this.#pending.size === 1) this.#coordinator.idle?.(false);
      this.#coordinator.post({ type: "job", id, op, args });
    });
  }
  terminate() {
    for (const w of this.#workers) {
      try {
        w.terminate();
      } catch {
      }
    }
  }
};

// node_modules/flashraw/dist/core.js
var OUTPUTS = Object.freeze([
  "raw-u16",
  "raw-f32",
  "normalized",
  "linear-rgb",
  "linear-rgb16",
  "linear-rgb-f16",
  "rgba8",
  "rgb16"
]);
var GPU_OUTPUTS = Object.freeze(["gpu-raw-u16", "gpu-normalized", "gpu-linear-rgb", "gpu-rgba8"]);
var BACKENDS = Object.freeze(["auto", "cpu", "cpu-simd", "gpu"]);
var SIMD_PROBE = new Uint8Array([
  0,
  97,
  115,
  109,
  1,
  0,
  0,
  0,
  1,
  5,
  1,
  96,
  0,
  1,
  123,
  3,
  2,
  1,
  0,
  10,
  10,
  1,
  8,
  0,
  65,
  0,
  253,
  15,
  253,
  98,
  11
]);
function simdSupported() {
  try {
    return typeof WebAssembly === "object" && WebAssembly.validate(SIMD_PROBE);
  } catch {
    return false;
  }
}
var dispose = Symbol.dispose ?? /* @__PURE__ */ Symbol.for("Symbol.dispose");
var now = () => typeof performance !== "undefined" ? performance.now() : Date.now();
var platform = {
  name: "unknown",
  load: () => {
    throw new InternalError('no flashraw platform registered (import "flashraw", not an internal module)');
  }
};
var wb = flashraw_bindgen_exports;
var wasm2 = null;
var build = null;
var threads = null;
var primary = null;
var engines = /* @__PURE__ */ new Map();
var reinitChain = Promise.resolve();
var gpuState = null;
var initPromise = null;
var initOptions = {};
var jxl = null;
var jxlPromise = null;
var jxlLoads = 0;
var jxlError = null;
var defaults = {};
var JPEGXL_MODES = Object.freeze(["auto", "always", "never"]);
function _setPlatform(p) {
  platform = p;
}
function _setDefaults(d) {
  Object.assign(defaults, d);
}
function init(options = {}) {
  if (!initPromise) {
    initOptions = options ?? {};
    initPromise = doInit(initOptions).catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}
function reinit(options = {}) {
  const run = reinitChain.then(async () => {
    const prev = initPromise;
    const prevOptions = initOptions;
    if (prev) await prev.catch(() => {
    });
    if (jxlPromise) await jxlPromise.catch(() => {
    });
    const hadEngine = !!primary && !!initPromise;
    initPromise = null;
    try {
      return await init(options);
    } catch (e) {
      if (hadEngine && !initPromise) {
        initOptions = prevOptions;
        initPromise = Promise.resolve({ ...build });
      }
      throw e;
    }
  });
  reinitChain = run.catch(() => {
  });
  return run;
}
function jpegxlMode(o) {
  if (o === void 0 || o === null) return "auto";
  if (!JPEGXL_MODES.includes(o)) {
    throw new InvalidArgumentError(`\`jpegxl\` must be "auto", "always" or "never", got ${JSON.stringify(o)}`);
  }
  return o;
}
async function doInit(options) {
  const t0 = now();
  const jxlMode = jpegxlMode(options.jpegxl ?? platform.defaultJpegxl?.() ?? defaults.jpegxl);
  const always = jxlMode === "always";
  const engineSimd = simdSupported();
  const pref = options.simd ?? platform.defaultSimd?.() ?? "auto";
  let variant = pref === false || !engineSimd ? "fallback" : "simd";
  const reason = pref === false ? "disabled by option" : !engineSimd ? "engine lacks WebAssembly SIMD" : null;
  let gpuInitReason = null;
  if (options.gpu === true) {
    if (variant !== "simd") gpuInitReason = `the WebGPU build requires WebAssembly SIMD (${reason})`;
    else {
      try {
        const cached = engines.get("gpu");
        const { glue: glue2, exports: exports2 } = cached ? { glue: cached.wb, exports: cached.wasm } : await initGpuBinary(options);
        const info = finishInit(glue2, exports2, null, {
          variant,
          binary: "gpu",
          simdSupported: engineSimd,
          fallbackReason: null,
          threadsReason: "the WebGPU build is single-threaded",
          gpuReason: null,
          jpegxlMode: jxlMode,
          t0
        });
        if (always) await loadJpegXl().catch(() => {
        });
        return info;
      } catch (e) {
        if (options.wasm) throw toError(e, "failed to load the FlashRaw WebGPU WebAssembly module");
        gpuInitReason = `the WebGPU build failed to load: ${e?.message ?? e}`;
      }
    }
  }
  const tOpt = options.threads ?? platform.defaultThreads?.() ?? defaults.threads ?? "auto";
  let threadsReason = null;
  if (options.gpu === true) threadsReason = "the WebGPU build was requested";
  else if (tOpt === false || tOpt === 0) threadsReason = "disabled by option";
  else if (variant !== "simd") threadsReason = `the threaded build requires WebAssembly SIMD (${reason})`;
  else if (!platform.threadSupport || !platform.spawnThread) threadsReason = "threads are not supported on this platform";
  else threadsReason = platform.threadSupport();
  if (!threadsReason) {
    const count = threadCount(tOpt === true || tOpt === "auto" ? void 0 : tOpt);
    try {
      const binary2 = always ? "threads-jxl" : "threads";
      const cached = engines.get(binary2);
      if (cached?.pool?.broken) throw cached.pool.broken;
      const { glue: glue2, exports: exports2, pool } = cached ? { glue: cached.wb, exports: cached.wasm, pool: cached.pool } : await initThreaded(options, count, binary2, options.wasm);
      return finishInit(glue2, exports2, pool, {
        variant,
        binary: binary2,
        simdSupported: engineSimd,
        fallbackReason: null,
        threadsReason: null,
        gpuReason: gpuInitReason,
        jpegxlMode: jxlMode,
        t0
      });
    } catch (e) {
      if (options.wasm) throw toError(e, "failed to start the FlashRaw threaded WebAssembly module");
      threadsReason = `the threaded build failed to start: ${e?.message ?? e}`;
    }
  }
  let exports;
  let binary = variant === "simd" && always ? "simd-jxl" : variant;
  const other = { simd: "fallback", fallback: "simd" }[binary];
  if (other && engines.has(other)) throw sharedGlueError(binary);
  let glue = binary === "simd-jxl" ? await platform.glue("simd-jxl") : flashraw_bindgen_exports;
  try {
    const cached = engines.get(binary);
    if (cached) exports = cached.wasm;
    else {
      const source = options.wasm ?? await platform.load(binary, options);
      exports = await glue.default({ module_or_path: await source });
    }
  } catch (e) {
    if (variant !== "simd" || options.wasm) throw toError(e, "failed to load the FlashRaw WebAssembly module");
    variant = binary = "fallback";
    glue = flashraw_bindgen_exports;
    if (engines.has("simd")) throw sharedGlueError("fallback");
    exports = await __wbg_init({ module_or_path: await platform.load(variant, options) }).catch((e2) => {
      throw toError(e2, "failed to load the FlashRaw WebAssembly module");
    });
  }
  return finishInit(glue, exports, null, {
    variant,
    binary,
    simdSupported: engineSimd,
    fallbackReason: variant === "fallback" ? reason ?? "SIMD binary failed to load" : null,
    threadsReason,
    gpuReason: gpuInitReason,
    jpegxlMode: jxlMode,
    t0
  });
}
function sharedGlueError(binary) {
  const name = (b) => b === "simd" ? "SIMD" : "scalar";
  const other = binary === "simd" ? "fallback" : "simd";
  return new NotAvailableError(
    `the ${name(binary)} build cannot be loaded next to the ${name(other)} build already in use: both share one wasm-bindgen glue module, which holds a single instance per page (reload the page to switch between them)`
  );
}
function finishInit(glue, exports, pool, extra) {
  const { t0, ...rest } = extra;
  const info = { ...JSON.parse(glue.buildInfo()), ...rest, initMs: now() - t0 };
  let eng = engines.get(rest.binary);
  if (eng) eng.build = info;
  else engines.set(rest.binary, eng = { wb: glue, wasm: exports, pool, build: info });
  primary = eng;
  wb = eng.wb;
  wasm2 = eng.wasm;
  threads = eng.pool;
  build = info;
  jxl = build.jpegxl ? eng : engines.get(eng.pool ? "threads-jxl" : "simd-jxl") ?? null;
  build.jpegxlReason = build.jpegxl ? null : jpegxlUnavailable();
  return { ...build };
}
function jpegxlUnavailable() {
  if (build.jpegxl) return null;
  if (build.jpegxlMode === "never") return 'disabled by option (jpegxl: "never")';
  if (!build.simd) {
    return `the JPEG XL variants require WebAssembly SIMD (${build.fallbackReason ?? "scalar build selected"})`;
  }
  return null;
}
function loadJpegXl() {
  if (jxl) return Promise.resolve(jxl);
  const why = jpegxlUnavailable();
  if (why) return Promise.reject(new NotAvailableError(why));
  jxlPromise ??= (async () => {
    const t0 = now();
    const o = initOptions;
    let threadsReason = build.threadsReason;
    if (threads && !threads.broken) {
      try {
        const cached2 = engines.get("threads-jxl");
        if (cached2 && !cached2.pool?.broken) return cached2;
        const { glue: glue2, exports: exports2, pool } = await initThreaded(o, threads.count, "threads-jxl", o.jpegxlWasm);
        return engineOf(glue2, exports2, pool, { binary: "threads-jxl", threadsReason: null, t0 });
      } catch (e) {
        if (o.jpegxlWasm) throw e;
        threadsReason = `the threaded JPEG XL build failed to start: ${e?.message ?? e}`;
      }
    }
    const cached = engines.get("simd-jxl");
    if (cached) return cached;
    const glue = await platform.glue("simd-jxl");
    const exports = await glue.default({ module_or_path: await (o.jpegxlWasm ?? platform.load("simd-jxl", o)) });
    return engineOf(glue, exports, null, { binary: "simd-jxl", threadsReason, t0 });
  })().then(
    (e) => {
      if (!engines.has(e.build.binary)) {
        engines.set(e.build.binary, e);
        jxlLoads++;
      }
      jxl = e;
      jxlError = null;
      return e;
    },
    (e) => {
      jxlPromise = null;
      jxlError = `the JPEG XL variant failed to load: ${e?.message ?? e}`;
      throw new NotAvailableError(jxlError, { cause: e });
    }
  );
  return jxlPromise;
}
function engineOf(glue, exports, pool, { t0, ...rest }) {
  const info = { ...JSON.parse(glue.buildInfo()), variant: "simd", ...rest, initMs: now() - t0 };
  return { wb: glue, wasm: exports, pool, build: info };
}
async function compileSource(src) {
  src = await src;
  if (src instanceof WebAssembly.Module) return src;
  if (typeof src === "string" || src instanceof URL) src = await fetch(src);
  if (typeof Response === "function" && src instanceof Response) {
    if (!src.ok) throw new Error(`failed to fetch the WebAssembly module: ${src.status} ${src.statusText}`);
    if (typeof WebAssembly.compileStreaming === "function") {
      const copy = src.clone();
      try {
        return await WebAssembly.compileStreaming(src);
      } catch {
        return WebAssembly.compile(await copy.arrayBuffer());
      }
    }
    return WebAssembly.compile(await src.arrayBuffer());
  }
  return WebAssembly.compile(src);
}
async function initThreaded(options, count, binary, source) {
  const glue = await platform.glue(binary);
  const module = await compileSource(source ?? platform.load(binary, options));
  const exports = await glue.default({ module_or_path: module });
  if (typeof exports.threadReserve === "function") glue.threadReserve(count);
  const pool = await ThreadPool.start({
    spawn: (name) => platform.spawnThread(name, options),
    module,
    memory: exports.memory,
    count
  });
  return { glue, exports, pool };
}
async function initGpuBinary(options) {
  const glue = await platform.glue("gpu");
  const exports = await glue.default({ module_or_path: await (options.wasm ?? platform.load("gpu", options)) });
  return { glue, exports };
}
function threadCount(opt) {
  if (typeof opt === "number") {
    if (!Number.isInteger(opt) || opt < 1) throw new InvalidArgumentError('`threads` must be a positive integer, true, false or "auto"');
    return Math.min(opt, 256);
  }
  const hc = Number(platform.hardwareConcurrency?.() ?? 4);
  return Math.max(1, Math.min(Number.isFinite(hc) ? hc : 4, 64));
}
async function initThreads(count) {
  const info = await init({ threads: count ?? true });
  return info.threadCount ?? 0;
}
function ensureInit() {
  if (!wasm2) throw new InternalError("FlashRaw is not initialised; `await init()` first");
}
function heap2(eng, Ctor, ptr, len) {
  return new Ctor(eng.wasm.memory.buffer, ptr, len);
}
function toError(e, context, eng = primary) {
  if (e instanceof FlashRawError) return e;
  if (e && typeof e === "object" && typeof e.kind === "string") {
    return errorFromKind(e.kind, e.message, e.corrupt ? { corrupt: e.corrupt } : void 0);
  }
  if (typeof WebAssembly === "object" && e instanceof WebAssembly.RuntimeError) {
    let panic = null;
    try {
      panic = (eng?.wb ?? wb).takeLastPanic() ?? null;
    } catch {
    }
    const hint = panic ? `panic: ${panic}` : `${e.message} (likely out of memory)`;
    return new InternalError(`FlashRaw WASM trap: ${hint}`, { cause: e });
  }
  const msg = e && typeof e === "object" && "message" in e ? e.message : String(e);
  return new InternalError(context ? `${context}: ${msg}` : msg, { cause: e });
}
function wcall(fn, eng = primary) {
  try {
    return fn();
  } catch (e) {
    throw toError(e, void 0, eng);
  }
}
var isBlob = (x) => typeof Blob !== "undefined" && x instanceof Blob;
var tag = (x) => Object.prototype.toString.call(x);
function asBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  const t = tag(input);
  if (t === "[object ArrayBuffer]" || t === "[object SharedArrayBuffer]") return new Uint8Array(input);
  return null;
}
function copyIn(eng, bytes) {
  const buf = wcall(() => new eng.wb.InputBuffer(bytes.length), eng);
  heap2(eng, Uint8Array, buf.ptr, bytes.length).set(bytes);
  return buf;
}
async function fill(eng, buf, size, chunks) {
  let off = 0;
  for await (const c of chunks) {
    if (off + c.length > size) throw new IoError(`input is longer than its announced size (${size} bytes)`);
    heap2(eng, Uint8Array, buf.ptr + off, c.length).set(c);
    off += c.length;
  }
  if (off !== size) throw new IoError(`input ended after ${off} of ${size} bytes`);
}
async function blobIn(eng, blob) {
  const size = blob.size;
  const buf = wcall(() => new eng.wb.InputBuffer(size), eng);
  try {
    try {
      await fill(eng, buf, size, blobChunks(blob));
    } catch (e) {
      if (e instanceof FlashRawError) throw e;
      await fill(eng, buf, size, blobSlices(blob));
    }
  } catch (e) {
    buf.free();
    throw e instanceof FlashRawError ? e : new IoError(`failed to read input: ${e?.message ?? e}`, { cause: e });
  }
  return buf;
}
var isShared = (b) => tag(b) === "[object SharedArrayBuffer]";
async function fileIn(eng, src) {
  const { size } = src;
  let buf;
  try {
    buf = wcall(() => new eng.wb.InputBuffer(size), eng);
  } catch (e) {
    await src.close();
    throw e;
  }
  const chunk = Math.max(1, Math.min(size, src.chunkSize ?? 8 << 20));
  const direct = isShared(eng.wasm.memory.buffer);
  const staging = direct ? null : new Uint8Array(chunk);
  let off = 0;
  try {
    while (off < size) {
      const n = Math.min(chunk, size - off);
      const got = await src.read(direct ? heap2(eng, Uint8Array, buf.ptr + off, n) : staging.subarray(0, n), off);
      if (got === 0) break;
      if (!direct) heap2(eng, Uint8Array, buf.ptr + off, got).set(staging.subarray(0, got));
      off += got;
    }
    if (off !== size) throw new IoError(`input ended after ${off} of ${size} bytes`);
  } catch (e) {
    buf.free();
    throw e instanceof FlashRawError ? e : new IoError(`failed to read input: ${e?.message ?? e}`, { cause: e });
  } finally {
    await src.close();
  }
  return buf;
}
async function* blobChunks(blob) {
  const reader = blob.stream().getReader();
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
var BLOB_SLICE = 8 << 20;
async function* blobSlices(blob) {
  for (let off = 0; off < blob.size; off += BLOB_SLICE) {
    yield new Uint8Array(await blob.slice(off, off + BLOB_SLICE).arrayBuffer());
  }
}
async function inputBuffer(eng, input) {
  const bytes = asBytes(input);
  if (bytes) return copyIn(eng, bytes);
  if (isBlob(input)) return blobIn(eng, input);
  if (typeof input === "string" || input instanceof URL) {
    if (!platform.fileSource) {
      throw new InvalidArgumentError("file paths are only supported in Node.js; pass bytes, a Blob or a File");
    }
    return fileIn(eng, await platform.fileSource(input));
  }
  throw new InvalidArgumentError(
    `unsupported input type ${tag(input)}; expected ArrayBuffer, Uint8Array/Buffer, another ArrayBufferView, Blob/File${platform.fileSource ? " or a file path" : ""}`
  );
}
function checkObject(o, what) {
  if (o === void 0 || o === null) return {};
  if (typeof o !== "object" || Array.isArray(o)) throw new InvalidArgumentError(`${what} must be an object`);
  return o;
}
var ARRAYS = { u16: Uint16Array, f16: Uint16Array, f32: Float32Array, u8: Uint8Array };
var live = /* @__PURE__ */ new Set();
var DecodedFrame = class {
  #data;
  #view;
  // { eng, frame, Ctor, ptr, len } while zero-copy
  constructor(info, data, view) {
    Object.assign(this, info);
    this.#data = data;
    this.#view = view;
    if (view) live.add(this);
  }
  /** Pixel data. For zero-copy frames, re-read this after other FlashRaw calls (memory growth). */
  get data() {
    const v = this.#view;
    if (v) {
      if (!this.#data || this.#data.buffer !== v.eng.wasm.memory.buffer) this.#data = heap2(v.eng, v.Ctor, v.ptr, v.len);
      return this.#data;
    }
    if (this.#data === null) throw new ClosedError("frame has been freed");
    return this.#data;
  }
  /** True while `data` is a view into WASM memory. */
  get zeroCopy() {
    return !!this.#view;
  }
  /** Copy of the pixels detached from WASM memory (always safe to keep or transfer). */
  detach() {
    const d = this.data;
    if (!this.#view) return d;
    const copy = d.slice();
    this.free();
    this.#data = copy;
    return copy;
  }
  /** Release the WASM buffer of a zero-copy frame (no-op for copied frames). */
  free() {
    const v = this.#view;
    if (v) {
      this.#view = null;
      this.#data = null;
      live.delete(this);
      try {
        v.frame.free();
      } catch {
      }
    }
  }
  [dispose]() {
    this.free();
  }
  /** `ImageData` for `rgba8` frames (browsers / environments with ImageData). */
  toImageData() {
    if (this.output !== "rgba8") throw new InvalidArgumentError('`toImageData()` requires output "rgba8"');
    if (typeof ImageData === "undefined") throw new NotAvailableError("ImageData is not available in this environment");
    const d = this.data;
    const shared = Object.prototype.toString.call(d.buffer) === "[object SharedArrayBuffer]";
    return new ImageData(shared ? new Uint8ClampedArray(d) : d, this.width, this.height);
  }
  /** Plain, structured-clone friendly object (`data` included). */
  toJSON() {
    return { ...this, data: void 0 };
  }
};
function profileToBase64(p, option = "outputProfile") {
  let u8;
  if (p instanceof Uint8Array) u8 = p;
  else if (ArrayBuffer.isView(p)) u8 = new Uint8Array(p.buffer, p.byteOffset, p.byteLength);
  else if (p instanceof ArrayBuffer || Object.prototype.toString.call(p) === "[object SharedArrayBuffer]") u8 = new Uint8Array(p);
  else throw new InvalidArgumentError(`\`${option}\` must be a Uint8Array (or ArrayBuffer) of profile bytes`);
  let bin = "";
  for (let i = 0; i < u8.length; i += 32768) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
  return btoa(bin);
}
function withProfile(info) {
  const b64 = info.iccProfile;
  info.iccProfile = typeof b64 === "string" ? Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) : null;
  return info;
}
function makeFrame(eng, frame, extra) {
  const t0 = now();
  const info = withProfile(JSON.parse(frame.infoJson()));
  const kind = frame.kind;
  const Ctor = kind === "u8" && info.output === "rgba8" ? Uint8ClampedArray : ARRAYS[kind];
  const ptr = frame.ptr;
  const len = frame.len;
  info.dataType = kind;
  info.backend = {
    ...info.backend,
    requested: extra.requested,
    fallbackReason: extra.fallbackReason ?? null,
    // Which WASM binary decoded it ('simd', 'threads', 'simd-jxl', 'threads-jxl', ...).
    binary: eng.build.binary,
    jpegxl: !!eng.build.jpegxl
  };
  info.timings = { ...info.timings, copyMs: 0, wallMs: 0 };
  let out;
  if (extra.zeroCopy) {
    out = new DecodedFrame(info, null, { eng, frame, Ctor, ptr, len });
  } else {
    const data = heap2(eng, Ctor, ptr, len).slice();
    frame.free();
    info.timings.copyMs = now() - t0;
    out = new DecodedFrame(info, data, null);
  }
  out.timings.wallMs = now() - extra.t0;
  return out;
}
function gpuStaticReason(eng = primary) {
  if (eng && eng !== primary && !eng.build.gpu) {
    return `this file is decoded by the ${eng.build.binary} build, which has no WebGPU backend`;
  }
  if (!eng?.build.gpu) {
    return `this FlashRaw WASM binary was built without the \`gpu\` feature (WebGPU backend not compiled in); load the WebGPU build with init({ gpu: true })${build?.gpuReason ? ` (${build.gpuReason})` : ""}`;
  }
  if (typeof navigator === "undefined" || !navigator.gpu) {
    return "WebGPU is not available in this environment (navigator.gpu is undefined)";
  }
  return null;
}
function gpuStatus(eng = primary) {
  const why = gpuStaticReason(eng);
  if (why) return Promise.resolve({ reason: why, adapter: null });
  gpuState ??= eng.wb.gpuInit().then(
    (json) => ({ reason: null, adapter: JSON.parse(json) }),
    (e) => ({ reason: String(e?.message ?? e), adapter: null })
  );
  return gpuState;
}
var isGpu = (b) => typeof b === "string" && ["gpu", "webgpu"].includes(b.toLowerCase());
var isGpuOutput = (o) => typeof o === "string" && o.toLowerCase().startsWith("gpu-");
var GpuFrame = class {
  #out;
  #eng;
  constructor(info, out, eng) {
    Object.assign(this, info);
    this.#out = out;
    this.#eng = eng;
    live.add(this);
  }
  #get() {
    if (!this.#out) throw new ClosedError("GPU frame has been freed or its buffer detached");
    return this.#out;
  }
  /** Always true: pixels live in `buffer`, not in host memory. */
  get gpuResident() {
    return true;
  }
  /** The `GPUBuffer` with the pixels (it may be larger than `byteLength`). */
  get buffer() {
    return wcall(() => this.#get().buffer);
  }
  /** Bytes of pixel data at the start of `buffer`. */
  get byteLength() {
    return wcall(() => this.#get().byteLength);
  }
  /** `'u16'` (two samples per 32-bit word), `'f32'` or `'rgba8'` (one RGBA pixel per word). */
  get format() {
    return wcall(() => this.#get().format);
  }
  /** The `GPUDevice` owning `buffer`. */
  get device() {
    return this.#eng.wb.gpuDevice();
  }
  /** Copy a `gpu-rgba8` frame into a new `rgba8unorm` `GPUTexture` (TEXTURE_BINDING | STORAGE_BINDING | COPY_SRC); the caller owns it. */
  createTexture() {
    return wcall(() => this.#get().createTexture());
  }
  /** Read back into host memory: a regular `DecodedFrame` with the host output (`rgba8`, ...). */
  async download() {
    const t0 = now();
    const out = this.#get();
    let f;
    try {
      f = await out.download();
    } catch (e) {
      throw toError(e, void 0, this.#eng);
    }
    return makeFrame(this.#eng, f, { requested: this.backend.requested, fallbackReason: null, zeroCopy: false, t0 });
  }
  /** Take ownership of `buffer` (FlashRaw will not recycle it; call `destroy()` when done). */
  detachBuffer() {
    const out = this.#get();
    const b = wcall(() => out.detachBuffer());
    this.free();
    return b;
  }
  /** Return the buffer to FlashRaw's pool (idempotent). */
  free() {
    const out = this.#out;
    this.#out = null;
    live.delete(this);
    if (out) {
      try {
        out.free();
      } catch {
      }
    }
  }
  [dispose]() {
    this.free();
  }
  toJSON() {
    return { ...this };
  }
};
async function getGpuDevice() {
  await init();
  const s = await gpuStatus();
  return s.reason ? null : wb.gpuDevice();
}
var TOKEN = /* @__PURE__ */ Symbol("flashraw.internal");
async function openIn(eng, buf, json) {
  if (eng.pool) {
    const input = wcall(() => buf.intoRaw(), eng);
    let ptr;
    try {
      ptr = await eng.pool.call("open", { input, options: json });
    } catch (e) {
      throw toError(e, void 0, eng);
    }
    return eng.wb.rawFileFromRaw(ptr);
  }
  return wcall(() => eng.wb.open(buf, json), eng);
}
var isJpegXlUnsupported = (e) => e?.kind === "UnsupportedCompression" && /JPEG XL/i.test(e.message);
function jpegXlError(why, cause) {
  return new UnsupportedCompressionError(
    `this JPEG XL DNG needs the JPEG XL variant of FlashRaw (\`flashraw_simd_jxl.wasm\`), which is not available: ${why}` + (build.jpegxlMode === "never" ? '; `init({ jpegxl: "auto" })` (the default) loads it when a file needs it' : ""),
    cause ? { cause } : void 0
  );
}
var FlashRaw = class {
  #raw;
  #eng;
  // engine holding #raw (the primary one, or the JPEG XL one after a switch)
  #openJson;
  // open options, to reopen the file in the JPEG XL engine
  #retired = [];
  // RawFiles replaced by a switch while zero-copy previews still point into them
  #switching = null;
  #cache = {};
  #broken = false;
  /** @internal use FlashRaw.open() */
  constructor(token, raw, eng, json) {
    if (token !== TOKEN) throw new TypeError("use `await FlashRaw.open(input)` to create a FlashRaw");
    this.#raw = raw;
    this.#eng = eng;
    this.#openJson = json;
  }
  /** Open a RAW file from bytes, a Blob/File, or (Node.js) a file path. */
  static async open(input, options) {
    const opts = checkObject(options, "options");
    await init(opts.init);
    const eng = primary;
    const buf = await inputBuffer(eng, input);
    const json = JSON.stringify({ limits: opts.limits ?? null });
    return new this(TOKEN, await openIn(eng, buf, json), eng, json);
  }
  /** The WASM binary serving this file (`'simd'`, `'threads'`, `'simd-jxl'`, ...). */
  get binary() {
    return this.#eng.build.binary;
  }
  /**
   * Make sure the engine of this handle can decode the file: a JPEG XL DNG opened in a build
   * without the codec moves to the JPEG XL engine (loaded on first need, then shared). The
   * metadata, previews and thumbnails never need it.
   */
  #ensureCodec() {
    if (this.#eng.build.jpegxl || this.frameInfo.compression !== "jpeg-xl") return null;
    if (build.jpegxlMode === "never") return null;
    return this.#switchToJpegXl();
  }
  #switchToJpegXl() {
    this.#switching ??= (async () => {
      let jx;
      try {
        jx = await loadJpegXl();
      } catch (e) {
        throw jpegXlError(e.message, e);
      }
      const from = this.#eng;
      const old = this.#raw;
      if (!old) throw new ClosedError("this FlashRaw handle is closed");
      if (from === jx) return;
      const len = wcall(() => old.inputLen(), from);
      const buf = wcall(() => new jx.wb.InputBuffer(len), jx);
      heap2(jx, Uint8Array, buf.ptr, len).set(heap2(from, Uint8Array, old.inputPtr(), len));
      const raw = await openIn(jx, buf, this.#openJson);
      if (this.#raw !== old) {
        raw.free();
        throw new ClosedError("this FlashRaw handle is closed");
      }
      this.#raw = raw;
      this.#eng = jx;
      if (live.has(this)) this.#retired.push({ eng: from, raw: old });
      else old.free();
    })().finally(() => {
      this.#switching = null;
    });
    return this.#switching;
  }
  /** Open a file by path (Node.js only). */
  static async openFile(path, options) {
    if (!platform.fileSource) throw new NotAvailableError("`FlashRaw.openFile()` is only available in Node.js");
    return this.open(path, options);
  }
  /** Initialise the WASM module (see `init`). */
  static init(options) {
    return init(options);
  }
  #call(fn) {
    if (!this.#raw) throw new ClosedError("this FlashRaw handle is closed");
    if (this.#broken) throw new InternalError("this FlashRaw handle is unusable after an internal error");
    try {
      return fn(this.#raw);
    } catch (e) {
      const err = toError(e, void 0, this.#eng);
      if (err.kind === "Internal") this.#broken = true;
      throw err;
    }
  }
  async #callAsync(fn) {
    if (!this.#raw) throw new ClosedError("this FlashRaw handle is closed");
    if (this.#broken) throw new InternalError("this FlashRaw handle is unusable after an internal error");
    try {
      return await fn(this.#raw);
    } catch (e) {
      const err = toError(e, void 0, this.#eng);
      if (err.kind === "Internal") this.#broken = true;
      throw err;
    }
  }
  /**
   * Threaded build: run `op` on the coordinator; resolves to the resulting wasm `Frame`. The job
   * holds its own strong reference to the file, so `close()` during a decode is safe.
   */
  async #job(op, args) {
    if (!this.#raw) throw new ClosedError("this FlashRaw handle is closed");
    if (this.#broken) throw new InternalError("this FlashRaw handle is unusable after an internal error");
    const { wb: wb2, pool } = this.#eng;
    const shared = wcall(() => this.#raw.share(), this.#eng);
    let released = false;
    try {
      const ptr = await pool.call(op, { ...args, shared });
      released = true;
      wb2.releaseShared(shared);
      return wb2.frameFromRaw(ptr);
    } catch (e) {
      const err = toError(e, void 0, this.#eng);
      if (err.kind === "Internal") this.#broken = true;
      throw err;
    } finally {
      if (!released && !pool.broken) wb2.releaseShared(shared);
    }
  }
  #json(key, fn) {
    return this.#cache[key] ??= JSON.parse(this.#call(fn));
  }
  get closed() {
    return !this.#raw;
  }
  /** Normalised metadata (no pixel decoding). Parsed once and cached. */
  get metadata() {
    return this.#json("metadata", (r) => r.metadataJson());
  }
  /** Geometry and calibration of the sensor buffer. */
  get frameInfo() {
    return this.#json("frameInfo", (r) => r.frameInfoJson());
  }
  /** What this file supports (random access, tiles, previews, ...). */
  get capabilities() {
    return this.#json("capabilities", (r) => r.capabilitiesJson());
  }
  /** Independently decodable tiles/strips (for `decodeTile`). */
  get tiles() {
    return this.#json("tiles", (r) => r.unitsJson());
  }
  get format() {
    return this.metadata.format;
  }
  get previews() {
    return this.metadata.previews;
  }
  /** Size of the input in bytes. */
  get byteLength() {
    return this.#call((r) => r.inputLen());
  }
  /** Milliseconds spent parsing the container in `open`. */
  get parseMs() {
    return this.#call((r) => r.parseMs());
  }
  /** Largest embedded preview, or `null` if the file has none. */
  async preview(options) {
    return this.#preview("largest", options);
  }
  /** Smallest embedded preview (thumbnail), or `null` if the file has none. */
  async thumbnail(options) {
    return this.#preview("smallest", options);
  }
  /** EXIF metadata as a standalone TIFF stream (a copy), or `null` if the file has none. */
  async exifBytes() {
    return this.#span((r) => r.exifSpan());
  }
  /** XMP packet (UTF-8 XML bytes, a copy), or `null` if the file has none. */
  async xmpBytes() {
    return this.#span((r) => r.xmpSpan());
  }
  #span(fn) {
    const s = this.#call(fn);
    return s ? heap2(this.#eng, Uint8Array, s[0], s[1]).slice() : null;
  }
  #preview(which, options) {
    const o = checkObject(options, "preview options");
    const sel = o.index !== void 0 && o.index !== null ? String(o.index) : which;
    if (o.index !== void 0 && o.index !== null && !(Number.isInteger(o.index) && o.index >= 0)) {
      throw new InvalidArgumentError("preview index must be a non-negative integer");
    }
    if ((o.index ?? null) === null && this.metadata.previews.length === 0) return null;
    const format = o.format ?? "encoded";
    const eng = this.#eng;
    if (format === "rgba8") {
      const t0 = now();
      const done = (f) => {
        try {
          const info2 = JSON.parse(f.infoJson());
          const data = heap2(eng, Uint8ClampedArray, f.ptr, f.len).slice();
          return { ...info2, format: "rgba8", data, decodeMs: now() - t0 };
        } finally {
          f.free();
        }
      };
      if (eng.pool) return this.#job("preview", { which: sel }).then(done);
      return done(this.#call((r) => r.decodePreview(sel)));
    }
    if (format !== "encoded") throw new InvalidArgumentError(`unknown preview format ${JSON.stringify(format)} (expected "encoded" or "rgba8")`);
    const [ptr, len, json] = this.#call((r) => r.previewSpan(sel));
    const info = { ...JSON.parse(json), format: "encoded" };
    if (!o.zeroCopy) return { ...info, data: heap2(eng, Uint8Array, ptr, len).slice() };
    live.add(this);
    let view = null;
    return Object.defineProperty(info, "data", {
      enumerable: true,
      get: () => {
        if (!this.#raw) throw new ClosedError("zero-copy preview used after `close()`");
        if (!view || view.buffer !== eng.wasm.memory.buffer) view = heap2(eng, Uint8Array, ptr, len);
        return view;
      }
    });
  }
  /** Decode the sensor data. */
  async decode(options) {
    return this.#decode(null, checkObject(options, "decode options"));
  }
  /** Decode only `region` (sensor-buffer coordinates). */
  async decodeRegion(region, options) {
    return this.#decode(null, { ...checkObject(options, "decode options"), region: checkObject(region, "region") });
  }
  /** Decode one tile/strip by index (see `tiles`). */
  async decodeTile(index, options) {
    if (!Number.isInteger(index) || index < 0) throw new InvalidArgumentError("tile index must be a non-negative integer");
    return this.#decode(index, checkObject(options, "decode options"));
  }
  async #decode(tile, options) {
    const t0 = now();
    const { backend = "auto", fallback = "cpu", zeroCopy = false, init: _init, ...rest } = options;
    if (rest.outputProfile != null) rest.outputProfile = profileToBase64(rest.outputProfile);
    if (rest.cameraProfile != null && rest.cameraProfile !== "embedded") {
      if (typeof rest.cameraProfile === "string") {
        throw new InvalidArgumentError('`cameraProfile` must be "embedded" or a Uint8Array (a .dcp file)');
      }
      rest.cameraProfile = { dcp: profileToBase64(rest.cameraProfile, "cameraProfile") };
    }
    if (fallback !== "cpu" && fallback !== "error") {
      throw new InvalidArgumentError(`\`fallback\` must be "cpu" or "error", got ${JSON.stringify(fallback)}`);
    }
    if (!this.#raw) throw new ClosedError("this FlashRaw handle is closed");
    const switching = this.#ensureCodec();
    if (switching) await switching;
    const extra = (fallbackReason2) => ({ requested: backend, fallbackReason: fallbackReason2, zeroCopy: !!zeroCopy, t0 });
    let effective = backend;
    let fallbackReason = null;
    const toCpu = (why) => {
      if (fallback === "error") throw new GpuUnavailableError(why);
      fallbackReason = why;
      if (isGpu(backend)) effective = "auto";
      if (isGpuOutput(rest.output)) rest.output = rest.output.slice(4);
    };
    if (isGpu(backend) || isGpuOutput(rest.output)) {
      if (!this.#raw) throw new ClosedError("this FlashRaw handle is closed");
      const eng = this.#eng;
      const { reason } = await gpuStatus(eng);
      if (reason) toCpu(reason);
      else {
        const json2 = JSON.stringify({ ...rest, backend: "gpu" });
        try {
          const r = await this.#callAsync((raw) => raw.decodeGpu(tile ?? -1, json2));
          if (r instanceof eng.wb.GpuOutput) {
            const info = withProfile(JSON.parse(r.infoJson()));
            info.backend = { ...info.backend, requested: backend, fallbackReason: null, binary: eng.build.binary, jpegxl: false };
            info.timings = { ...info.timings, copyMs: 0, wallMs: now() - t0 };
            return new GpuFrame(info, r, eng);
          }
          return makeFrame(eng, r, extra(null));
        } catch (e) {
          if (e.kind !== "GpuUnavailable") throw e;
          toCpu(e.message);
        }
      }
    }
    const json = JSON.stringify({ ...rest, backend: effective });
    const cpu = () => this.#eng.pool ? this.#job("decode", { tile: tile ?? -1, options: json }) : this.#call((r) => tile === null ? r.decode(json) : r.decodeTile(tile, json));
    let frame;
    try {
      frame = await cpu();
    } catch (e) {
      if (!isJpegXlUnsupported(e) || this.#eng.build.jpegxl) throw e;
      if (build.jpegxlMode === "never") throw jpegXlError(build.jpegxlReason, e);
      await this.#switchToJpegXl();
      frame = await cpu();
    }
    return makeFrame(this.#eng, frame, extra(fallbackReason));
  }
  /** Release the WASM memory held by this handle (idempotent). */
  close() {
    const r = this.#raw;
    this.#raw = null;
    this.#cache = {};
    live.delete(this);
    for (const old of [r, ...this.#retired.splice(0).map((x) => x.raw)]) {
      if (!old) continue;
      try {
        old.free();
      } catch {
      }
    }
  }
  [dispose]() {
    this.close();
  }
};
async function withRaw(input, options, fn) {
  const raw = await FlashRaw.open(input, options);
  try {
    return await fn(raw);
  } finally {
    raw.close();
  }
}
function decodeRaw(input, options) {
  const o = checkObject(options, "options");
  return withRaw(input, o, (r) => r.decode({ ...o, zeroCopy: false }));
}
function readMetadata(input, options) {
  return withRaw(input, options, (r) => r.metadata);
}
function extractPreview(input, options) {
  const o = checkObject(options, "options");
  return withRaw(input, o, (r) => r.preview({ ...o, zeroCopy: false }));
}
function extractThumbnail(input, options) {
  const o = checkObject(options, "options");
  return withRaw(input, o, (r) => r.thumbnail({ ...o, zeroCopy: false }));
}
var PROBE_BYTES = 1 << 20;
function detectBytes(b) {
  return wcall(() => wb.detect(b)) ?? null;
}
async function loadJpegXlSupport() {
  await init();
  return (await loadJpegXl()).build.binary;
}
async function detectFormat(input) {
  await init();
  if (isBlob(input)) {
    const head = new Uint8Array(await input.slice(0, PROBE_BYTES).arrayBuffer());
    const f2 = detectBytes(head);
    if (f2 || input.size <= PROBE_BYTES) return f2;
    return detectBytes(new Uint8Array(await input.arrayBuffer()));
  }
  if ((typeof input === "string" || input instanceof URL) && platform.readHead) {
    const { head, size } = await platform.readHead(input, PROBE_BYTES);
    const f2 = detectBytes(head);
    if (f2 || size <= PROBE_BYTES) return f2;
    return detectBytes((await platform.readHead(input, size)).head);
  }
  const b = asBytes(input);
  if (!b) throw new InvalidArgumentError(`unsupported input type ${tag(input)}`);
  const f = detectBytes(b.length > PROBE_BYTES ? b.subarray(0, PROBE_BYTES) : b);
  return f || b.length <= PROBE_BYTES ? f : detectBytes(b);
}
async function supportsFile(input) {
  return await detectFormat(input) !== null;
}
async function getCapabilities() {
  let initError = null;
  try {
    await init();
  } catch (e) {
    initError = e;
  }
  const nav = typeof navigator !== "undefined" ? navigator : void 0;
  const gpu = build ? await gpuStatus() : { reason: "module not loaded", adapter: null };
  return {
    version: build?.version ?? null,
    platform: platform.name,
    wasm: {
      loaded: !!wasm2,
      variant: build?.variant ?? null,
      binary: build?.binary ?? null,
      initMs: build?.initMs ?? null,
      error: initError ? initError.message : null
    },
    simd: {
      supported: simdSupported(),
      active: build?.simd ?? false,
      level: build?.simdLevel ?? null,
      fallbackReason: build?.fallbackReason ?? null
    },
    threads: {
      wasmThreads: build?.threads ?? false,
      count: threads && !threads.broken ? threads.count : 0,
      reason: build ? build.threadsReason ?? (threads?.broken ? threads.broken.message : null) : "module not loaded",
      sharedArrayBuffer: typeof SharedArrayBuffer === "function",
      crossOriginIsolated: globalThis.crossOriginIsolated === true,
      hardwareConcurrency: platform.hardwareConcurrency?.() ?? nav?.hardwareConcurrency ?? 1,
      workers: platform.workers?.() ?? typeof Worker === "function"
    },
    gpu: {
      compiled: build?.gpu ?? false,
      webgpu: !!nav?.gpu,
      available: gpu.reason === null,
      reason: gpu.reason,
      adapter: gpu.adapter
    },
    jpegxl: {
      mode: build?.jpegxlMode ?? null,
      compiled: build?.jpegxl ?? false,
      loaded: !!jxl,
      binary: jxl?.build.binary ?? null,
      available: !!build && !build.jpegxlReason,
      reason: build ? build.jpegxlReason ?? jxlError : "module not loaded"
    },
    outputs: [...OUTPUTS, ...build?.gpu ? GPU_OUTPUTS : []],
    backends: [...BACKENDS],
    limits: { maxSamples: build?.maxSamples ?? null }
  };
}
function _internals() {
  ensureInit();
  return {
    wasm: wasm2,
    build: { ...build },
    liveCount: live.size,
    threads: threads?.count ?? 0,
    threadStartGrowth: threads?.memoryGrowth ?? null,
    jpegxl: { loads: jxlLoads, binary: jxl?.build.binary ?? null, threads: jxl?.pool?.count ?? 0 },
    engines: [...engines.keys()]
  };
}

// node_modules/flashraw/dist/browser.js
var FILES = {
  simd: "flashraw_simd.wasm",
  fallback: "flashraw.wasm",
  threads: "flashraw_simd_threads.wasm",
  gpu: "flashraw_simd_gpu.wasm",
  "simd-jxl": "flashraw_simd_jxl.wasm",
  "threads-jxl": "flashraw_simd_threads_jxl.wasm"
};
function wasmUrl(variant, options) {
  if (options.baseUrl) return new URL(FILES[variant], options.baseUrl);
  switch (variant) {
    case "simd":
      return new URL("./flashraw_simd.wasm", import.meta.url);
    case "threads":
      return new URL("./flashraw_simd_threads.wasm", import.meta.url);
    case "gpu":
      return new URL("./flashraw_simd_gpu.wasm", import.meta.url);
    case "simd-jxl":
      return new URL("./flashraw_simd_jxl.wasm", import.meta.url);
    case "threads-jxl":
      return new URL("./flashraw_simd_threads_jxl.wasm", import.meta.url);
    default:
      return new URL("./flashraw.wasm", import.meta.url);
  }
}
function glueOf(variant) {
  switch (variant) {
    case "threads":
      return import("./chunks/flashraw_bindgen_threads-SZG7BMH5.js");
    case "gpu":
      return import("./chunks/flashraw_bindgen_gpu-FHM72YXA.js");
    case "simd-jxl":
      return import("./chunks/flashraw_bindgen_jxl-N2RMEATP.js");
    case "threads-jxl":
      return import("./chunks/flashraw_bindgen_threads_jxl-ORFWLKQC.js");
    default:
      throw new Error(`no glue for ${JSON.stringify(variant)}`);
  }
}
function wrapWorker(w) {
  return {
    post: (msg) => w.postMessage(msg),
    onMessage: (cb) => w.addEventListener("message", (e) => cb(e.data)),
    onError: (cb) => {
      w.addEventListener("error", (e) => {
        e.preventDefault?.();
        cb(e.error ?? new Error(e.message || "worker error (failed to load the thread worker script?)"));
      });
      w.addEventListener("messageerror", () => cb(new Error("worker message could not be deserialised")));
    },
    terminate: () => w.terminate()
  };
}
_setPlatform({
  name: typeof window === "undefined" && typeof self !== "undefined" ? "worker" : "browser",
  // fetch() + instantiateStreaming compiles while downloading (served as application/wasm).
  load: (variant, options) => fetch(wasmUrl(variant, options)),
  glue: glueOf,
  // SharedArrayBuffer (and so shared WebAssembly.Memory) requires cross-origin isolation:
  // COOP `same-origin` + COEP `require-corp` (or `credentialless`) on the page.
  threadSupport() {
    if (typeof Worker !== "function") return "Web Workers are not available";
    if (globalThis.crossOriginIsolated !== true) {
      return "the page is not cross-origin isolated, so SharedArrayBuffer is unavailable (serve it with COOP: same-origin and COEP: require-corp)";
    }
    if (typeof SharedArrayBuffer !== "function") return "SharedArrayBuffer is not available";
    return null;
  },
  // Literal worker options: bundlers only rewrite `new Worker(new URL(...), { static })`.
  spawnThread: (name, options) => wrapWorker(
    options.threadWorkerUrl ? new Worker(options.threadWorkerUrl, { type: "module", name }) : new Worker(new URL("./thread-worker.browser.js", import.meta.url), { type: "module", name: "flashraw-thread" })
  ),
  hardwareConcurrency: () => globalThis.navigator?.hardwareConcurrency ?? 1
});

// node_modules/flashraw/dist/worker-entry.browser.js
_setDefaults({ threads: false });
serve(browser_exports, {
  post: (msg, transfer) => self.postMessage(msg, transfer),
  listen: (cb) => self.addEventListener("message", (e) => cb(e.data))
});
