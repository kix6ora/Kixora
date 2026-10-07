// ==============================================================================
// KIXORA ORDER CSV EXPORT
// Generates a CSV string from an array of order objects (admin reconciliation).
// ==============================================================================

export function generateOrderCSV(orders: any[]): string {
  if (!orders || orders.length === 0) return '';

  const headers = ['Order ID', 'Date', 'Customer', 'Total', 'Payment Status', 'Current Status', 'Reference'];
  const rows = orders.map(o => [
    o.id || o.order_code,
    new Date(o.createdAt || o.created_at).toLocaleDateString(),
    o.customer?.fullName || o.customer_snapshot?.fullName || 'N/A',
    o.total,
    o.payment_status,
    o.current_status,
    o.payment_reference || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  return csvContent;
}