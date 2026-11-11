/**
 * @module core/Pool
 * Generic object pool. Owners keep their own active lists and release objects back here.
 * @template T
 */
export class Pool {
  /**
   * @param {() => T} factory
   * @param {number} [prefill=0]
   */
  constructor(factory, prefill = 0) {
    this.factory = factory;
    /** @type {T[]} */
    this.free = [];
    for (let i = 0; i < prefill; i++) this.free.push(factory());
  }
  /** @returns {T} */
  acquire() {
    return this.free.length > 0 ? /** @type {T} */ (this.free.pop()) : this.factory();
  }
  /** @param {T} obj */
  release(obj) {
    this.free.push(obj);
  }
  get available() { return this.free.length; }
}
