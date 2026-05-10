// Minimal stand-in for the "obsidian" module so smoke tests can exercise
// pure logic in src/ without booting Obsidian. Only the surfaces actually
// referenced by code under test are implemented; everything else is a no-op
// or a stub that records calls.

export const requestUrlMock = {
  calls: [] as Array<{ url: string; method?: string; headers?: Record<string, string> }>,
  responder: null as null | ((req: { url: string }) => {
    status: number;
    json: unknown;
    headers: Record<string, string>;
  }),
};

export function resetRequestUrlMock(
  responder: (req: { url: string }) => {
    status: number;
    json: unknown;
    headers: Record<string, string>;
  },
) {
  requestUrlMock.calls = [];
  requestUrlMock.responder = responder;
}

export async function requestUrl(req: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  throw?: boolean;
}) {
  requestUrlMock.calls.push({
    url: req.url,
    method: req.method,
    headers: req.headers,
  });
  if (!requestUrlMock.responder) {
    return { status: 200, json: {}, headers: {} as Record<string, string> };
  }
  return requestUrlMock.responder({ url: req.url });
}

export function normalizePath(p: string) {
  return p.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export class Notice {
  constructor(_msg: string, _timeout?: number) {}
}

export class Plugin {
  app: unknown;
  manifest: unknown;
  settings: unknown;
  loadData(): Promise<unknown> {
    return Promise.resolve(null);
  }
  saveData(_data: unknown): Promise<void> {
    return Promise.resolve();
  }
  addCommand(_cmd: unknown): void {}
  addSettingTab(_tab: unknown): void {}
  addStatusBarItem(): unknown {
    return { setText: () => undefined };
  }
  registerInterval(_id: number): void {}
}

export class PluginSettingTab {
  app: unknown;
  plugin: unknown;
  containerEl: unknown;
  constructor(app: unknown, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = {};
  }
  display(): void {}
}

export class Modal {
  app: unknown;
  contentEl: unknown;
  titleEl: unknown;
  constructor(app: unknown) {
    this.app = app;
    this.contentEl = {};
    this.titleEl = {};
  }
  open(): void {}
  close(): void {}
}

export class Setting {
  setName(_name: string): this {
    return this;
  }
  setDesc(_desc: unknown): this {
    return this;
  }
  setHeading(): this {
    return this;
  }
  addText(_cb: unknown): this {
    return this;
  }
  addDropdown(_cb: unknown): this {
    return this;
  }
  addToggle(_cb: unknown): this {
    return this;
  }
  addButton(_cb: unknown): this {
    return this;
  }
  addSlider(_cb: unknown): this {
    return this;
  }
  addTextArea(_cb: unknown): this {
    return this;
  }
}

export class TFile {
  path = "";
  name = "";
  extension = "";
}

export class TFolder {
  path = "";
  children: unknown[] = [];
}

export class App {
  vault: unknown;
  fileManager: unknown;
  constructor() {
    this.vault = {};
    this.fileManager = {};
  }
}
