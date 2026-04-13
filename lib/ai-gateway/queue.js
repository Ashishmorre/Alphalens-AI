/**
 * ThrottledQueue - A lightweight Promise-based queue
 * Enforces minimum delay between task executions
 */

export class ThrottledQueue {
  constructor(delayMs = 1600) {
    this.delayMs = delayMs;
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Add a task to the queue
   * @param {Function} taskFn - Async function to execute
   * @returns {Promise} Resolves/Rejects with task result
   */
  enqueue(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process tasks sequentially with delay between each
   */
  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const { taskFn, resolve, reject } = this.queue.shift();

      try {
        const result = await taskFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }

      // Enforce minimum delay before next task
      if (this.queue.length > 0) {
        await this.sleep(this.delayMs);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
