import { FormEvent, useEffect, useState } from 'react';
import { approveOrder, fetchOrders, rejectOrder } from '../api/admin';
import { getErrorMessage } from '../api/client';
import type { Paginated } from '../api/types';
import { useAuth } from '../context/AuthContext';
import {
  formatDateTime,
  formatMoney,
  formatTelegramUser,
  labelBillingPeriod,
  labelOrderStatus,
  labelPlan,
  t,
} from '../i18n';

type OrderRow = {
  id: string;
  status: string;
  billingPeriod: string;
  amount: string;
  currency: string;
  createdAt: string;
  hasReceipt: boolean;
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    telegramAccount: { telegramId: bigint | string; username: string | null; firstName: string | null } | null;
  };
  plan: { code: string; name: string };
};

const APPROVABLE = new Set(['RECEIPT_SUBMITTED', 'UNDER_REVIEW']);
const REJECTABLE = new Set(['PENDING', 'RECEIPT_SUBMITTED', 'UNDER_REVIEW']);

export function OrdersPage() {
  const strings = t();
  const { hasPermission } = useAuth();
  const canApprove = hasPermission('orders:approve');
  const canReject = hasPermission('orders:reject');
  const [data, setData] = useState<Paginated<OrderRow> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchOrders(page, search)
      .then((res) => setData(res as Paginated<OrderRow>))
      .catch((err) => setError(getErrorMessage(err, strings.errors.loadOrders)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [page, search]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  async function approve(id: string) {
    if (!confirm(strings.orders.confirmApprove)) return;
    setActing(`${id}:approve`);
    setError('');
    try {
      await approveOrder(id);
      load();
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.approveOrder));
    } finally {
      setActing(null);
    }
  }

  async function reject(id: string) {
    if (!confirm(strings.orders.confirmReject)) return;
    setActing(`${id}:reject`);
    setError('');
    try {
      await rejectOrder(id);
      load();
    } catch (err) {
      setError(getErrorMessage(err, strings.errors.rejectOrder));
    } finally {
      setActing(null);
    }
  }

  return (
    <div>
      <h1>{strings.orders.title}</h1>
      <form className="toolbar" onSubmit={onSearch}>
        <input placeholder={strings.common.search} value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn-secondary">{strings.common.search}</button>
      </form>
      {loading && <p>{strings.orders.loading}</p>}
      {error && <div className="alert error">{error}</div>}
      {!loading && data && data.items.length === 0 && <p className="muted">{strings.orders.empty}</p>}
      {!loading && data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{strings.orders.colNumber}</th>
                  <th>{strings.orders.colUser}</th>
                  <th>{strings.orders.colTelegram}</th>
                  <th>{strings.orders.colPlan}</th>
                  <th>{strings.orders.colPeriod}</th>
                  <th>{strings.orders.colAmount}</th>
                  <th>{strings.orders.colStatus}</th>
                  <th>{strings.orders.colDate}</th>
                  {(canApprove || canReject) && <th>{strings.common.actions}</th>}
                </tr>
              </thead>
              <tbody>
                {data.items.map((order, index) => {
                  const telegram = order.user.telegramAccount
                    ? {
                        telegramId: String(order.user.telegramAccount.telegramId),
                        username: order.user.telegramAccount.username,
                        firstName: order.user.telegramAccount.firstName,
                      }
                    : null;
                  const showApprove = canApprove && APPROVABLE.has(order.status) && order.hasReceipt;
                  const showReject = canReject && REJECTABLE.has(order.status);

                  return (
                    <tr key={order.id}>
                      <td className="mono">{String((data.meta.page - 1) * data.meta.limit + index + 1)}</td>
                      <td>{order.user.displayName ?? order.user.email ?? strings.common.dash}</td>
                      <td>{formatTelegramUser(telegram ?? undefined)}</td>
                      <td>{labelPlan(order.plan)}</td>
                      <td>{labelBillingPeriod(order.billingPeriod)}</td>
                      <td>{formatMoney(order.amount, order.currency)}</td>
                      <td>{labelOrderStatus(order.status)}</td>
                      <td>{formatDateTime(order.createdAt)}</td>
                      {(canApprove || canReject) && (
                        <td className="actions-cell">
                          {showApprove && (
                            <button
                              type="button"
                              className="btn-primary"
                              disabled={acting === `${order.id}:approve`}
                              onClick={() => void approve(order.id)}
                            >
                              {acting === `${order.id}:approve` ? strings.orders.approving : strings.orders.approve}
                            </button>
                          )}
                          {showReject && (
                            <button
                              type="button"
                              className="btn-danger"
                              disabled={acting === `${order.id}:reject`}
                              onClick={() => void reject(order.id)}
                            >
                              {acting === `${order.id}:reject` ? strings.orders.rejecting : strings.orders.reject}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{strings.common.previousPage}</button>
            <span>{strings.common.pageOf(data.meta.page, data.meta.totalPages)}</span>
            <button type="button" className="btn-secondary" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>{strings.common.nextPage}</button>
          </div>
        </>
      )}
    </div>
  );
}
