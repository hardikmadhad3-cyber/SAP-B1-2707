'use strict';
const { text, dateOnly } = require('./documentSeriesPolicy');

// System authorization IDs must come from the installed SAP SDK Permissions
// List. These are identifiers, not grants; actual rights are always read from SAP.
// Deployments can supply a version-specific catalogue without changing company
// numbering data. No permission or missing catalogue is treated as authorization.
const readPermissionCatalogue = () => {
  try {
    const catalogue = JSON.parse(process.env.SAP_SERIES_PERMISSION_CATALOGUE || '{}');
    if (!catalogue.manual || !catalogue.groups || typeof catalogue.groups !== 'object') throw new Error();
    return catalogue;
  } catch (_) {
    throw Object.assign(new Error('SAP numbering authorization identifiers are not configured. Configure SAP_SERIES_PERMISSION_CATALOGUE from the installed SAP SDK Permissions List to enable series for non-superusers.'), { statusCode: 422, code: 'SAP_SERIES_PERMISSION_CATALOGUE' });
  }
};
const isFull = (value) => ['F', '1', 'BOPER_FULL'].includes(text(value).toUpperCase());
const readSeriesPermissions = async ({ read, user, catalogue = readPermissionCatalogue(), now = new Date() }) => {
  const today = dateOnly(now);
  const active = (row) => (!row.StartDate || today >= dateOnly(row.StartDate)) && (!row.DueDate || today <= dateOnly(row.DueDate));
  const [direct, memberships, groups] = await Promise.all([
    read('USR3', ['UserLink', 'PermId', 'Permission'], { UserLink: user.USERID }),
    read('USR7', ['UserId', 'GroupId', ['StartDate'], ['DueDate']], { UserId: user.USERID }, { optional: true }),
    read('OUGR', ['GroupId', ['StartDate'], ['DueDate'], ['GroupType', "'A'"]], {}, { optional: true }),
  ]);
  const grants = new Set(direct.filter(row => isFull(row.Permission)).map(row => text(row.PermId)));
  // SAP combines user and active user-group rights using the most permissive
  // authorization. An explicit denial on the user does not erase a group grant.
  const activeGroups = memberships.filter(active).filter(row => groups.some(group => Number(group.GroupId) === Number(row.GroupId) && active(group) && (!group.GroupType || ['A', 'L'].includes(text(group.GroupType)))));
  for (const group of activeGroups) {
    const permissions = await read('UGR1', ['GroupLink', 'PermId', 'Permission'], { GroupLink: group.GroupId });
    for (const permission of permissions) if (isFull(permission.Permission)) grants.add(text(permission.PermId));
  }
  return { manualAllowed: grants.has(text(catalogue.manual)),
    groups: new Set(Object.entries(catalogue.groups).filter(([, permission]) => grants.has(text(permission))).map(([group]) => Number(group))) };
};
module.exports = { readSeriesPermissions, readPermissionCatalogue };
