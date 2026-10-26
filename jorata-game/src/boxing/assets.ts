export const ASSET_BASE = '/boxing';

export const CHARACTER_SPRITE_FILES = [
  'idle_01.png',
  'idle_02.png',
  'idle_03.png',
  'walk_01.png',
  'walk_02.png',
  'walk_03.png',
  'jab_01.png',
  'jab_02.png',
  'jab_03.png',
  'hook_01.png',
  'hook_02.png',
  'hook_03.png',
  'uppercut_01.png',
  'uppercut_02.png',
  'uppercut_03.png',
  'block.png',
  'duck_01.png',
  'duck_02.png',
  'hit_01.png',
  'hit_02.png',
  'ko_01.png',
  'ko.png',
  'win.png',
] as const;

export type CharacterSpriteFile = (typeof CHARACTER_SPRITE_FILES)[number];

export const BOXING_ASSET_PATHS = {
  backgrounds: {
    full: `${ASSET_BASE}/backgrounds/ring/ring_background_full.png`,
    alt: `${ASSET_BASE}/backgrounds/ring/ring_background_alternative.png`,
    floor: `${ASSET_BASE}/backgrounds/ring/layers/ring_floor.png`,
    ropeLeft: `${ASSET_BASE}/backgrounds/ring/layers/ring_rope_left.png`,
    ropeRight: `${ASSET_BASE}/backgrounds/ring/layers/ring_rope_right.png`,
    cornerRed: `${ASSET_BASE}/backgrounds/ring/layers/corner_red.png`,
    cornerBlue: `${ASSET_BASE}/backgrounds/ring/layers/corner_blue.png`,
    crowdStrip: `${ASSET_BASE}/backgrounds/ring/layers/crowd_strip.png`,
    stageLights: `${ASSET_BASE}/backgrounds/ring/layers/stage_lights.png`,
  },
  effects: {
    hitSparks01: `${ASSET_BASE}/effects/hit_sparks_01.png`,
    hitSparks02: `${ASSET_BASE}/effects/hit_sparks_02.png`,
    hitSparks03: `${ASSET_BASE}/effects/hit_sparks_03.png`,
    hitSparks04: `${ASSET_BASE}/effects/hit_sparks_04.png`,
    hitSparks05: `${ASSET_BASE}/effects/hit_sparks_05.png`,
    hitFlash: `${ASSET_BASE}/effects/hit_flash.png`,
    punchTrailRed: `${ASSET_BASE}/effects/punch_trail_red.png`,
    punchTrailBlue: `${ASSET_BASE}/effects/punch_trail_blue.png`,
    punchTrailAlt: `${ASSET_BASE}/effects/punch_trail_alt.png`,
    impactDust01: `${ASSET_BASE}/effects/impact_dust_01.png`,
    impactDust02: `${ASSET_BASE}/effects/impact_dust_02.png`,
    impactDust03: `${ASSET_BASE}/effects/impact_dust_03.png`,
    impactSmoke: `${ASSET_BASE}/effects/impact_smoke.png`,
    knockdownDust: `${ASSET_BASE}/effects/knockdown_dust.png`,
    ringShake: `${ASSET_BASE}/effects/ring_shake.png`,
    starStun: `${ASSET_BASE}/effects/star_stun.png`,
  },
  ui: {
    healthBarRed: `${ASSET_BASE}/ui/health_bar_red.png`,
    healthBarBlue: `${ASSET_BASE}/ui/health_bar_blue.png`,
    staminaBar: `${ASSET_BASE}/ui/stamina_bar.png`,
    barBackground: `${ASSET_BASE}/ui/bar_background.png`,
    versus: `${ASSET_BASE}/ui/versus.png`,
    roundNumbers: `${ASSET_BASE}/ui/round_numbers.png`,
    roundTimer: `${ASSET_BASE}/ui/round_timer.png`,
    ko: `${ASSET_BASE}/ui/ko.png`,
    win: `${ASSET_BASE}/ui/win.png`,
    draw: `${ASSET_BASE}/ui/draw.png`,
    portraitRed: `${ASSET_BASE}/ui/portrait_red.png`,
    portraitBlue: `${ASSET_BASE}/ui/portrait_blue.png`,
    crown: `${ASSET_BASE}/ui/crown.png`,
    medals: `${ASSET_BASE}/ui/medals.png`,
    roundDot: `${ASSET_BASE}/ui/round_dot.png`,
    roundDotEmpty: `${ASSET_BASE}/ui/round_dot_empty.png`,
    pause: `${ASSET_BASE}/ui/pause.png`,
  },
  props: {
    stoolRed: `${ASSET_BASE}/props/stool_red.png`,
    stoolBlue: `${ASSET_BASE}/props/stool_blue.png`,
    bucket: `${ASSET_BASE}/props/bucket.png`,
    waterBottle: `${ASSET_BASE}/props/water_bottle.png`,
    towel: `${ASSET_BASE}/props/towel.png`,
    bannerRed: `${ASSET_BASE}/props/banner_red.png`,
    bannerBlue: `${ASSET_BASE}/props/banner_blue.png`,
    championshipBelt: `${ASSET_BASE}/props/championship_belt.png`,
    gloveRed: `${ASSET_BASE}/props/glove_red.png`,
    gloveBlue: `${ASSET_BASE}/props/glove_blue.png`,
  },
  characters: {
    red: Object.fromEntries(
      CHARACTER_SPRITE_FILES.map(f => [f, `${ASSET_BASE}/characters/player_red/${f}`])
    ) as Record<CharacterSpriteFile, string>,
    blue: Object.fromEntries(
      CHARACTER_SPRITE_FILES.map(f => [f, `${ASSET_BASE}/characters/player_blue/${f}`])
    ) as Record<CharacterSpriteFile, string>,
  },
} as const;

export function getAllBoxingAssetUrls(): string[] {
  const urls: string[] = [];
  for (const group of [
    BOXING_ASSET_PATHS.backgrounds,
    BOXING_ASSET_PATHS.effects,
    BOXING_ASSET_PATHS.ui,
    BOXING_ASSET_PATHS.props,
    BOXING_ASSET_PATHS.characters.red,
    BOXING_ASSET_PATHS.characters.blue,
  ]) {
    for (const url of Object.values(group)) {
      urls.push(url);
    }
  }
  return urls;
}

export interface BoxingAssetStore {
  images: Map<string, HTMLImageElement>;
  ready: boolean;
  loaded: number;
  total: number;
  failed: string[];
  get(url: string): HTMLImageElement | undefined;
}

let sharedStore: BoxingAssetStore | null = null;
let sharedPromise: Promise<BoxingAssetStore> | null = null;

export function getBoxingAssetStore(): BoxingAssetStore {
  if (sharedStore) return sharedStore;
  const urls = getAllBoxingAssetUrls();
  sharedStore = {
    images: new Map(),
    ready: false,
    loaded: 0,
    total: urls.length,
    failed: [],
    get(url: string) {
      return this.images.get(url);
    },
  };
  return sharedStore;
}

export function preloadBoxingAssets(
  onProgress?: (store: BoxingAssetStore) => void
): Promise<BoxingAssetStore> {
  const store = getBoxingAssetStore();
  if (store.ready) {
    onProgress?.(store);
    return Promise.resolve(store);
  }
  if (sharedPromise) {
    return sharedPromise.then(s => {
      onProgress?.(s);
      return s;
    });
  }

  const urls = getAllBoxingAssetUrls();
  sharedPromise = new Promise(resolve => {
    let settled = 0;
    const finishOne = () => {
      settled += 1;
      onProgress?.(store);
      if (settled >= urls.length) {
        store.ready = true;
        onProgress?.(store);
        resolve(store);
      }
    };

    for (const url of urls) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        store.images.set(url, img);
        store.loaded += 1;
        finishOne();
      };
      img.onerror = () => {
        store.failed.push(url);
        finishOne();
      };
      img.src = url;
    }
  });

  return sharedPromise;
}
