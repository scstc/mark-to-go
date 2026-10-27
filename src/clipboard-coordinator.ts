export type ClipboardOutcome = 'copied' | 'skipped';

/** One queue for automatic exports and explicit text/file copy actions. */
export class ClipboardCoordinator {
	private generation = 0;
	private tail: Promise<unknown> = Promise.resolve();
	private stopped = false;
	private active?: AbortController;

	claim(): number {
		this.active?.abort();
		return ++this.generation;
	}

	write(ticket: number, action: (signal: AbortSignal) => Promise<void>): Promise<ClipboardOutcome> {
		const operation = this.tail.catch(() => undefined).then(async (): Promise<ClipboardOutcome> => {
			if (this.stopped || ticket !== this.generation) return 'skipped';
			const controller = new AbortController();
			this.active = controller;
			try {
				await action(controller.signal);
				return controller.signal.aborted || ticket !== this.generation ? 'skipped' : 'copied';
			} catch (error) {
				if (controller.signal.aborted) return 'skipped';
				throw error;
			} finally {
				if (this.active === controller) this.active = undefined;
			}
		});
		this.tail = operation;
		return operation;
	}

	dispose(): void {
		this.generation++;
		this.stopped = true;
		this.active?.abort();
	}
}
