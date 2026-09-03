import { FormEvent, useEffect, useState } from 'react';
import { bootstrapSystemPlans, fetchPlans, updatePlan } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  formatMoney,
  labelBillingPeriod,
  labelPlanCode,
  labelPlanPurchaseAvailability,
  t,
} from '../i18n';

type PlanRow = Awaited<ReturnType<typeof fetchPlans>>['plans'][number];

function priceForPeriod(plan: PlanRow, period: 'MONTHLY' | 'YEARLY'): string {
  return plan.prices.find((price) => price.billingPeriod === period)?.amount ?? '';
}

function planHasPrice(plan: PlanRow, period: 'MONTHLY' | 'YEARLY'): boolean {
  if (period === 'MONTHLY') {
    return plan.priceConfigured?.monthly ?? Boolean(priceForPeriod(plan, 'MONTHLY'));
  }
  return plan.priceConfigured?.yearly ?? Boolean(priceForPeriod(plan, 'YEARLY'));
}

export function PlansPage() {
  const strings = t();
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission('plans:update');

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [missingCodes, setMissingCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [draftPrices, setDraftPrices] = useState<Record<string, { monthly: string; yearly: string }>>({});

  const applyCatalog = (data: Awaited<ReturnType<typeof fetchPlans>>) => {
    setPlans(data.plans);
    setMissingCodes(data.missingCanonicalCodes);
  };

  const load = () => {
    setLoading(true);
    fetchPlans()
      .then(applyCatalog)
      .catch((err) => setError(getErrorMessage(err, strings.errors.loadPlans)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [strings.errors.loadPlans]);

  const restoreCanonical = async () => {
    if (!canUpdate) return;
    if (!window.confirm(strings.plans.bootstrapConfirm)) return;
    setBootstrapping(true);
    setError('');
    try {
      applyCatalog(await bootstrapSystemPlans());
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.savePlan));
    } finally {
      setBootstrapping(false);
    }
  };

  const toggleAvailability = async (plan: PlanRow) => {
    if (!canUpdate) return;
    setSavingCode(plan.code);
    setError('');
    try {
      applyCatalog(await updatePlan(plan.code, { isActive: !plan.isActive }));
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.savePlan));
    } finally {
      setSavingCode(null);
    }
  };

  const startEditPrices = (plan: PlanRow) => {
    setEditingCode(plan.code);
    setDraftPrices((prev) => ({
      ...prev,
      [plan.code]: {
        monthly: priceForPeriod(plan, 'MONTHLY'),
        yearly: priceForPeriod(plan, 'YEARLY'),
      },
    }));
  };

  const savePrices = async (event: FormEvent, plan: PlanRow) => {
    event.preventDefault();
    if (!canUpdate) return;
    const draft = draftPrices[plan.code];
    if (!draft) return;

    setSavingCode(plan.code);
    setError('');
    try {
      const prices = [
        draft.monthly.trim()
          ? { billingPeriod: 'MONTHLY' as const, amount: draft.monthly.trim() }
          : null,
        draft.yearly.trim()
          ? { billingPeriod: 'YEARLY' as const, amount: draft.yearly.trim() }
          : null,
      ].filter((row): row is { billingPeriod: 'MONTHLY' | 'YEARLY'; amount: string } => Boolean(row));
      applyCatalog(await updatePlan(plan.code, { prices }));
      setEditingCode(null);
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.savePlan));
    } finally {
      setSavingCode(null);
    }
  };

  if (loading) return <p>{strings.plans.loading}</p>;

  const emptyCatalog = plans.length === 0;

  return (
    <div>
      <h1>{strings.plans.title}</h1>
      <p className="muted">{strings.plans.note}</p>
      {error && <div className="alert error">{error}</div>}

      {emptyCatalog && (
        <div className="card section">
          <h2>{strings.plans.emptyTitle}</h2>
          <p>{strings.plans.emptyBody}</p>
          {canUpdate && (
            <button type="button" className="btn-primary" disabled={bootstrapping} onClick={() => void restoreCanonical()}>
              {bootstrapping ? strings.plans.saving : strings.plans.restoreAll}
            </button>
          )}
        </div>
      )}

      <div className="grid cards plan-cards">
        {plans.map((plan) => {
          const editing = editingCode === plan.code;
          const draft = draftPrices[plan.code];
          const busy = savingCode === plan.code;
          const monthlyConfigured = planHasPrice(plan, 'MONTHLY');
          const yearlyConfigured = planHasPrice(plan, 'YEARLY');
          const pricesMissing = !monthlyConfigured || !yearlyConfigured;

          return (
            <div key={plan.id} className="card plan-card">
              <div className="plan-card-header">
                <h2>{labelPlanCode(plan.code)}</h2>
                <span className={plan.isActive ? 'badge success' : 'badge muted'}>
                  {labelPlanPurchaseAvailability(plan.isActive)}
                </span>
              </div>

              {pricesMissing && <p className="alert warn">{strings.plans.priceNotConfiguredHint}</p>}

              <dl className="plan-meta">
                <div>
                  <dt>{strings.plans.price30}</dt>
                  <dd>
                    {monthlyConfigured
                      ? formatMoney(priceForPeriod(plan, 'MONTHLY'), 'TJS')
                      : strings.plans.priceNotConfigured}
                  </dd>
                </div>
                <div>
                  <dt>{strings.plans.price365}</dt>
                  <dd>
                    {yearlyConfigured
                      ? formatMoney(priceForPeriod(plan, 'YEARLY'), 'TJS')
                      : strings.plans.priceNotConfigured}
                  </dd>
                </div>
                <div>
                  <dt>{strings.plans.maxDevices}</dt>
                  <dd>{plan.maxDevices ?? '—'}</dd>
                </div>
                <div>
                  <dt>{strings.plans.licenses}</dt>
                  <dd>{plan.licenseCount}</dd>
                </div>
                <div>
                  <dt>{strings.plans.orders}</dt>
                  <dd>{plan.orderCount}</dd>
                </div>
              </dl>

              {editing && draft && (
                <form className="plan-price-form" onSubmit={(event) => void savePrices(event, plan)}>
                  <label>
                    {labelBillingPeriod('MONTHLY')}
                    <input
                      value={draft.monthly}
                      onChange={(event) =>
                        setDraftPrices((prev) => ({
                          ...prev,
                          [plan.code]: { ...prev[plan.code], monthly: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    {labelBillingPeriod('YEARLY')}
                    <input
                      value={draft.yearly}
                      onChange={(event) =>
                        setDraftPrices((prev) => ({
                          ...prev,
                          [plan.code]: { ...prev[plan.code], yearly: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <div className="plan-actions">
                    <button type="submit" className="btn-primary" disabled={busy}>
                      {busy ? strings.plans.saving : strings.plans.savePrices}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setEditingCode(null)}>
                      {strings.common.cancel}
                    </button>
                  </div>
                </form>
              )}

              {canUpdate && !editing && (
                <div className="plan-actions">
                  <button
                    type="button"
                    className={plan.isActive ? 'btn-secondary' : 'btn-primary'}
                    disabled={busy}
                    onClick={() => void toggleAvailability(plan)}
                  >
                    {busy
                      ? strings.plans.saving
                      : plan.isActive
                        ? strings.plans.disable
                        : strings.plans.enable}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => startEditPrices(plan)}>
                    {strings.plans.editPrices}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {missingCodes.map((code) => (
          <div key={code} className="card plan-card">
            <div className="plan-card-header">
              <h2>{labelPlanCode(code)}</h2>
              <span className="badge muted">{strings.plans.notConfigured}</span>
            </div>
            <p className="muted">{strings.plans.missingPlanHint}</p>
            {canUpdate && (
              <button
                type="button"
                className="btn-primary"
                disabled={bootstrapping}
                onClick={() => void restoreCanonical()}
              >
                {bootstrapping ? strings.plans.saving : strings.plans.createCanonical(labelPlanCode(code))}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
