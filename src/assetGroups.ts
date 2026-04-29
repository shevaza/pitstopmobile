export const assetGroups = ["IT Assets", "Facilities Assets"] as const;

export type AssetGroup = (typeof assetGroups)[number];

export function getAssetGroupsFromApi(value: unknown) {
  return Array.isArray(value) && value.length
    ? value.filter((group): group is string => typeof group === "string" && assetGroups.includes(group as AssetGroup))
    : [...assetGroups];
}
