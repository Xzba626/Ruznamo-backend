import { assertAllScreensHaveParentOrRoot, BotScreen, SCREEN_PARENT, backParent } from './bot-screens';
import { CALLBACK_INVENTORY, isAdminCallback, matchInventory } from './callback-inventory';

describe('Telegram bot screen state machine', () => {
  it('defines a Back parent for every non-root non-auth screen', () => {
    expect(assertAllScreensHaveParentOrRoot()).toEqual([]);
  });

  it('maps license device confirm back to device detail', () => {
    expect(backParent(BotScreen.USER_DEVICE_DISCONNECT_CONFIRM)).toBe(BotScreen.USER_DEVICE_DETAIL);
    expect(SCREEN_PARENT[BotScreen.USER_LICENSE_DEVICES]).toBe(BotScreen.USER_LICENSE_DETAIL);
  });

  it('maps admin licenses to admin root', () => {
    expect(backParent(BotScreen.ADMIN_LICENSES_LIST)).toBe(BotScreen.ADMIN_ROOT);
  });
});

describe('callback inventory', () => {
  it('registers admin:licenses', () => {
    expect(matchInventory('admin:licenses')?.handlerHint).toBe('adminLicenses');
  });

  it('marks payment approve as admin', () => {
    expect(isAdminCallback('payment:approve:abc')).toBe(true);
    expect(isAdminCallback('action:get_key')).toBe(false);
  });

  it('has inventory entries for core user actions', () => {
    const patterns = CALLBACK_INVENTORY.map((e) => e.pattern);
    expect(patterns).toEqual(expect.arrayContaining(['action:get_key', 'action:my_sub', 'admin:licenses']));
  });
});
