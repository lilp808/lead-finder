export const collectors = {
  facebook: () => import('./facebook.js'),
  ddproperty: () => import('./ddproperty.js'),
};

export async function getCollector(platform) {
  const loader = collectors[platform];
  if (!loader) return null;
  const mod = await loader();
  return {
    platform: mod.platform,
    label: mod.label,
    isAvailable: mod.isAvailable,
    disabledHint: mod.disabledHint,
    collect: mod.collect,
  };
}