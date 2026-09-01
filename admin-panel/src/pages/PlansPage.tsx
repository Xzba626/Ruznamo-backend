import { FormEvent, useEffect, useState } from 'react';
import { fetchPlans, updatePlan } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  formatMoney,
  labelBillingPeriod,
  labelPlanCode,
  labelPlanPurchaseAvailability,
  t,
} from '../i18n';

type PlanRow = Awaited<ReturnType<typeof fetchPlans>>[number];

function priceForPeriod(plan: PlanRow, period: 'MONTHLY' | 'YEARLY'): string {
  return plan.prices.find((price) => price.billingPeriod === period)?.amount ?? '';
}

export function PlansPage() {
  const strings = t();
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission('plans:update');

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [draftPrices, setDraftPrices] = useState<Record<string, { monthly: string; yearly: string }>>({});

  const load = () => {
    setLoading(true);
    fetchPlans()
      .then(setPlans)
      .catch((err) => setError(getErrorMessage(err, strings.errors.loadPlans)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [strings.errors.loadPlans]);

  const toggleAvailability = async (plan: PlanRow) => {
    if (!canUpdate) return;
    setSavingCode(plan.code);
    setError('');
    try {
      const updated = await updatePlan(plan.code, { isActive: !plan.isActive });
      setPlans(updated);
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
      const updated = await updatePlan(plan.code, {
        prices: [
          { billingPeriod: 'MONTHLY', amount: draft.monthly },
          { billingPeriod: 'YEARLY', amount: draft.yearly },
        ],
      });
      setPlans(updated);
      setEditingCode(null);
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.savePlan));
    } finally {
      setSavingCode(null);
    }
  };

  if (loading) return <p>{strings.plans.loading}</p>;

  return (
    <div>
      <h1>{strings.plans.title}</h1>
      <p className="muted">{strings.plans.note}</p>
      {error && <div className="alert error">{error}</div>}

      <div className="grid cards plan-cards">
        {plans.map((plan) => {
          const editing = editingCode === plan.code;
          const draft = draftPrices[plan.code];
          const busy = savingCode === plan.code;

          return (
            <div key={plan.id} className="card plan-card">
              <div className="plan-card-header">
                <h2>{labelPlanCode(plan.code)}</h2>
                <span className={plan.isActive ? 'badge success' : 'badge muted'}>
                  {labelPlanPurchaseAvailability(plan.isActive)}
                </span>
              </div>

              <p className="muted">{plan.name}</p>

              <dl className="plan-meta">
                <div>
                  <dt>{strings.plans.price30}</dt>
                  <dd>{formatMoney(priceForPeriod(plan, 'MONTHLY'), 'TJS')}</dd>
                </div>
                <div>
                  <dt>{strings.plans.price365}</dt>
                  <dd>{formatMoney(priceForPeriod(plan, 'YEARLY'), 'TJS')}</dd>
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
      </div>
    </div>
  );
}
