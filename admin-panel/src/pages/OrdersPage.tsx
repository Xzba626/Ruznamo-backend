import { FormEvent, useEffect, useState } from 'react';
import { approveOrder, fetchOrder, fetchOrders, rejectOrder } from '../api/admin';
import { getErrorMessage } from '../api/client';
import type { Paginated } from '../api/types';
import { useAuth } from '../context/AuthContext';
import {
  formatDateTime,
  formatMoney,
  formatTelegramUser,
  labelBillingPeriod,
  labelLicenseStatus,
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
  paymentMethodName?: string | null;
  hasReceipt: boolean;
  license: { id: string; keyPrefix: string; status: string } | null;
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    telegramAccount: { telegramId: bigint | string; username: string | null; firstName: string | null } | null;
  };
  plan: { code: string; name: string };
};

type OrderDetail = {
  id: string;
  status: string;
  billingPeriod: string;
  amount: string;
  currency: string;
  createdAt: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  rejectionReasonCode?: string | null;
  paymentMethodName?: string | null;
  paymentMethodType?: string | null;
  paymentMethodValue?: string | null;
  paymentMethodRecipient?: string | null;
  user: OrderRow['user'];
  plan: { code: string; name: string; deviceLimit: number | null };
  receipts: Array<{ id: string; status: string; submittedAt: string }>;
  license: {
    id: string;
    keyPrefix: string;
    status: string;
    startsAt?: string | null;
    expiresAt?: string | null;
    activatedAt?: string | null;
    activationCount: number;
    deviceLimit: number | null;
    activations: Array<{
      id: string;
      activatedAt: string;
      device: {
        id: string;
        deviceName: string | null;
        installationId: string;
        platform: string;
        appVersion: string | null;
        lastSeenAt: string;
      };
      mobileUser: { id: string; displayName: string | null; email: string | null } | null;
    }>;
  } | null;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    fetchOrder(selectedId)
      .then((res) => setDetail(res as OrderDetail))
      .catch((err) => setError(getErrorMessage(err, strings.errors.loadOrder)))
      .finally(() => setDetailLoading(false));
  }, [selectedId, strings.errors.loadOrder]);

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
      if (selectedId === id) {
        const refreshed = await fetchOrder(id);
        setDetail(refreshed as OrderDetail);
      }
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
      if (selectedId === id) {
        const refreshed = await fetchOrder(id);
        setDetail(refreshed as OrderDetail);
      }
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
                  <th>{strings.orders.colPaymentMethod}</th>
                  <th>{strings.orders.colStatus}</th>
                  <th>{strings.orders.colDate}</th>
                  <th>{strings.orders.colReceipt}</th>
                  <th>{strings.orders.colLicense}</th>
                  <th>{strings.common.actions}</th>
                  {(canApprove || canReject) && <th />}
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
                      <td>{order.paymentMethodName ?? strings.common.dash}</td>
                      <td>{labelOrderStatus(order.status)}</td>
                      <td>{formatDateTime(order.createdAt)}</td>
                      <td>{order.hasReceipt ? strings.orders.hasReceipt : strings.orders.noReceipt}</td>
                      <td>{order.license ? strings.orders.licenseLinked : strings.orders.noLicense}</td>
                      <td>
                        <button type="button" className="btn-secondary" onClick={() => setSelectedId(order.id)}>
                          {strings.orders.details}
                        </button>
                      </td>
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

      {selectedId && (
        <section className="section card order-detail">
          <div className="detail-header">
            <h2>{strings.orders.detailTitle} {selectedId}</h2>
            <button type="button" className="btn-secondary" onClick={() => setSelectedId(null)}>{strings.orders.close}</button>
          </div>
          {detailLoading && <p>{strings.common.loading}</p>}
          {!detailLoading && detail && (
            <>
              <h3>{strings.orders.sectionPayment}</h3>
              <p>{labelOrderStatus(detail.status)} · {labelPlan(detail.plan)} · {labelBillingPeriod(detail.billingPeriod)} · {formatMoney(detail.amount, detail.currency)}</p>
              {detail.paymentMethodName && (
                <p>{strings.orders.colPaymentMethod}: {detail.paymentMethodName}{detail.paymentMethodRecipient ? ` · ${detail.paymentMethodRecipient}` : ''}</p>
              )}
              <p className="muted">{formatDateTime(detail.createdAt)}</p>
              {detail.status === 'REJECTED' && (
                <>
                  {detail.rejectedAt && (
                    <p className="muted">Rejected: {formatDateTime(detail.rejectedAt)}</p>
                  )}
                  {(detail.rejectionReason || detail.rejectionReasonCode) && (
                    <p>
                      Reason
                      {detail.rejectionReasonCode ? ` [${detail.rejectionReasonCode}]` : ''}:{' '}
                      {detail.rejectionReason ?? '—'}
                    </p>
                  )}
                </>
              )}

              <h3>{strings.orders.sectionTelegram}</h3>
              <p>{formatTelegramUser(detail.user.telegramAccount ? {
                telegramId: String(detail.user.telegramAccount.telegramId),
                username: detail.user.telegramAccount.username,
                firstName: detail.user.telegramAccount.firstName,
              } : undefined)}</p>
              <p>{detail.user.displayName ?? detail.user.email ?? strings.common.dash}</p>

              <h3>{strings.orders.sectionLicense}</h3>
              {!detail.license ? (
                <p className="muted">{strings.orders.notActivated}</p>
              ) : (
                <>
                  <p>{detail.license.keyPrefix}… · {labelLicenseStatus(detail.license.status)}</p>
                  <p>{strings.orders.activationCount}: {detail.license.activationCount}{detail.license.deviceLimit != null ? ` / ${detail.license.deviceLimit}` : ''}</p>
                  {detail.license.expiresAt && <p className="muted">{formatDateTime(detail.license.expiresAt)}</p>}
                </>
              )}

              <h3>{strings.orders.sectionActivations}</h3>
              {!detail.license || detail.license.activations.length === 0 ? (
                <p className="muted">{strings.orders.notActivated}</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Устройство</th>
                        <th>{strings.orders.appVersion}</th>
                        <th>{strings.orders.mobileUser}</th>
                        <th>Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.license.activations.map((activation) => (
                        <tr key={activation.id}>
                          <td>{activation.device.deviceName ?? activation.device.installationId}</td>
                          <td>{activation.device.appVersion ?? strings.common.dash}</td>
                          <td>{activation.mobileUser?.displayName ?? activation.mobileUser?.email ?? activation.mobileUser?.id ?? strings.common.dash}</td>
                          <td>{formatDateTime(activation.activatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
