type Category = "roads" | "lighting" | "drains" | "waste";
type ReportStatus = "review" | "progress" | "resolved";
type Priority = "high" | "medium" | "low";
type View = "home" | "map" | "reports" | "council";
type Language = "en" | "bm";
type Point = [number, number];
type Cleanup = () => void;
type MotionPreference = boolean | (() => boolean);

interface MapReport {
  id: string;
  title: string;
  category: Category;
  status: ReportStatus;
  point: Point;
  lngLat?: Point;
}
interface CityReport extends MapReport {
  place: string;
  area: string;
  description: string;
  descriptionBm?: string;
  date: string;
  time: string;
  priority: Priority;
  support: number;
  own: boolean;
  photo?: string;
  local?: boolean;
}
interface ReportDraft {
  step: 1 | 2 | 3 | 4;
  description: string;
  category: Category;
  location: string;
  photo: string;
  point: Point;
  lngLat?: Point;
  priority: Priority;
  language: Language;
  title: string;
  texts: Record<Language, string>;
  progress: number;
  pickerOpen?: boolean;
}
interface AppState {
  view: View;
  category: Category | "all";
  status: ReportStatus | "all";
  query: string;
  reportTab: "mine" | "following";
  councilMode: "queue" | "board";
  homeText: string;
  homeCategory: Category | null;
  story: number;
  mapZoom: number;
  mapX: number;
  mapY: number;
}
interface MapOptions {
  reduced?: MotionPreference;
  interactive?: boolean;
  center?: Point;
  zoom?: number;
  onReport?: (id: string) => void;
  onPick?: (point: Point, lngLat: Point) => void;
}
interface MapHandle {
  ready: Promise<boolean>;
  destroy: Cleanup;
  setReports: (reports: MapReport[]) => boolean;
}
interface CityMapAPI {
  mount(
    container: string | HTMLElement | null,
    reports?: MapReport[],
    options?: MapOptions,
  ): MapHandle | null;
  destroyAll(): void;
  zoom(delta: number): boolean;
  recenter(): boolean;
  setReports(reports: MapReport[]): boolean;
  toPoint(lngLat: unknown): Point | null;
  toLngLat(point: unknown): Point | null;
  pointFromLngLat(lngLat: unknown): Point | null;
  lngLatFromPoint(point: unknown): Point | null;
}
interface PhotoOptions {
  onPhoto?: (photo: File) => void;
  onCancel?: Cleanup;
}
interface StoryOptions {
  reduced?: MotionPreference;
  onSwipe?: (direction: "left" | "right") => void;
}
interface InstallChoice {
  outcome: "accepted" | "dismissed";
  platform: string;
}
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<InstallChoice | void>;
  userChoice: Promise<InstallChoice>;
}
interface InstallInstructions {
  platform: string;
  title: string;
  steps: string[];
}
type InstallOutcome = "accepted" | "dismissed" | "installed" | "error";
interface PWAState {
  installed: boolean;
  canPrompt: boolean;
  prompting: boolean;
  secure: boolean;
  serviceWorker: "idle" | "unsupported" | "registering" | "ready" | "error";
  updateAvailable: boolean;
  lastOutcome: InstallOutcome | null;
}
type InstallResult =
  | {
      status: InstallOutcome | "prompting";
      platform?: string;
      message?: string;
    }
  | ({ status: "instructions" } & InstallInstructions);
interface Window {
  __fixmycitySkipIntro: boolean;
  CityMap: CityMapAPI;
  PhotoPicker: {
    open(options?: PhotoOptions): void;
    close(delivered?: boolean): void;
  };
  StoryGestures: {
    bind(stage: HTMLElement | null, options?: StoryOptions): Cleanup;
  };
  FixMyCityPWA: {
    getState(): Readonly<PWAState>;
    install(): Promise<InstallResult>;
    subscribe(listener: (state: Readonly<PWAState>) => void): Cleanup;
  };
  FixMyCityIntro: {
    readonly duration: number;
    play(): void;
    pause(): void;
    seek(milliseconds: number): void;
    readonly time: number;
    readonly completed: boolean;
  };
}
interface Navigator {
  readonly standalone?: boolean;
}
interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
  "fixmycity:install-instructions": CustomEvent<InstallInstructions>;
  "fixmycity:pwa-state": CustomEvent<Readonly<PWAState>>;
}
