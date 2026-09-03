# Telegram Callback Inventory

Source of truth in code: `src/telegram/nav/callback-inventory.ts`.

| Pattern | Role | Emitting screen | Handler |
|---------|------|-----------------|---------|
| `lang:tj` / `lang:ru` | any | language | setLanguage + resume deferred |
| `action:main_menu` | any | nav | role root |
| `action:get_key` | user | USER_ROOT | buy / pending re-entry |
| `action:my_sub` | user | USER_ROOT | licenses list |
| `action:recover` | user | USER_ROOT | recovery instruction |
| `action:language` | any | root | language picker |
| `action:support` | user | USER_ROOT | support categories |
| `action:instruction` | user | USER_ROOT | instruction root |
| `instruct:*` | user | instruction | article |
| `support:cat:*` | user | support | open conversation |
| `action:support_exit` / close confirm/cancel | user | support | close flow |
| `plan:*` / `duration:*` / `paymethod:*` | user | buy | purchase |
| `action:send_receipt` / cancel_payment* | user | receipt | receipt UX |
| `action:continue_pending` / `new_purchase` | user | buy | pending order |
| `licenses:page:*` | user | licenses | pagination |
| `lic:detail:*` | user | licenses | license detail |
| `licdev:*` | user | license | devices |
| `licdevitem:*` | user | devices | device detail |
| `licrev:confirm:*` / `licrev:do:*` | user | devices | disconnect |
| `link:*` / `repl:*` | user | deeplink | confirm/cancel |
| `payment:approve:*` / `payment:reject:*` | admin | orders | payment decision |
| `admin:orders` | admin | ADMIN_ROOT | pending orders |
| `admin:pm:*` | admin | requisites | payment methods wizard |
| `admin:support:*` | admin | support | inbox / reply / close |
| `admin:licenses` / `admin:lic:*` | admin | licenses | list/detail/devices/revoke |
| `admin:create_license` / `admin:lic:create:*` | admin | create | issuance wizard |

Unknown callbacks → stale message + Home. Non-admin on admin prefix → denied.
