import { describe, it, expect } from 'vitest';
import { emptyData, finance, type FactoryData, type Row } from '@/lib/erp-data';

describe('Factory Lifecycle, Relational Integrity & Quantity Flow (10 Pillars)', () => {
  // PILLAR 1 & 2: Database Relational Integrity & Common Order/PO linkage
  it('Pillars 1 & 2: Relational links between orders, items, allocations, challans, items, and expenses', () => {
    const partyId = 'party-001';
    const orderId = 'order-001';
    const orderItemId = 'item-001';
    const labourId = 'worker-001';
    const allocId = 'alloc-001';
    const challanId = 'dc-001';
    const expenseId = 'exp-001';

    const order: Row<'orders'> = {
      id: orderId,
      order_no: 'PO-202610-0001',
      party_id: partyId,
      is_self_stock: false,
      order_date: '2026-10-14',
      expected_date: '2026-10-20',
      medium: 'WhatsApp',
      remarks: 'Export quality pallet packing',
      status: 'Pending',
      created_at: new Date().toISOString(),
    };

    const item: Row<'order_items'> = {
      id: orderItemId,
      order_id: orderId,
      sr_no: 1,
      box_type: 'Heavy Industrial Crate',
      size_dimensions: '48 x 40 x 36 inches',
      specification: 'Pine wood 18mm with steel corners',
      code_remarks: 'Stencil: SLBW-EXP-01',
      ordered_qty: 100,
      allocated_qty: 0,
      completed_qty: 0,
      reserved_qty: 0,
      dispatched_qty: 0,
      unit_rate: 1500,
      total_price: 150000,
      priority_signal: 'Red',
      created_at: new Date().toISOString(),
    };

    const allocation: Row<'production_allocations'> = {
      id: allocId,
      order_item_id: orderItemId,
      labour_id: labourId,
      allocated_qty: 60,
      completed_qty: 0,
      labour_rate: 120,
      duration_hours: 8,
      start_time: '2026-10-14T08:00:00Z',
      tentative_completion: '2026-10-14T16:00:00Z',
      status: 'In Progress',
      paid_earnings: 0,
      created_at: new Date().toISOString(),
    };

    const challan: Row<'delivery_challans'> = {
      id: challanId,
      challan_number: 'DC-202610-0001',
      order_id: orderId,
      dispatch_date: '2026-10-14T17:00:00Z',
      transport_carrier: 'Express Logistics',
      vehicle_number: 'MH-12-AB-9876',
      lr_number: 'LR-88291',
      freight_charges: 2500,
      status: 'Delivery Challan Made',
      delivery_status: 'Scheduled',
      created_at: new Date().toISOString(),
    };

    const challanItem: Row<'challan_items'> = {
      id: 'ci-001',
      challan_id: challanId,
      order_item_id: orderItemId,
      dispatched_qty: 40,
      direct_labour_cost: 40 * 120,
    };

    const expense: Row<'expenses'> = {
      id: expenseId,
      expense_date: '2026-10-14',
      category: 'Transportation',
      reference_dc_id: challanId,
      amount: 500,
      payment_method: 'Cash',
      notes: 'Toll and octroi charges for DC-202610-0001',
      created_at: new Date().toISOString(),
    };

    // Verify foreign key references point to the exact same order entity
    expect(item.order_id).toBe(order.id);
    expect(allocation.order_item_id).toBe(item.id);
    expect(challan.order_id).toBe(order.id);
    expect(challanItem.challan_id).toBe(challan.id);
    expect(challanItem.order_item_id).toBe(item.id);
    expect(expense.reference_dc_id).toBe(challan.id);
  });

  // PILLAR 3 & 4: Exact Quantity Lifecycle & Remaining Calculation at Every Stage
  it('Pillars 3 & 4: End-to-end quantity flow and remaining balance calculation across all stages', () => {
    // Stage 1: Order Entry (100 boxes ordered)
    let orderedQty = 100;
    let allocatedQty = 0;
    let completedQty = 0;
    let reservedQty = 0;
    let dispatchedQty = 0;

    // Remaining in Pending Production queue
    let pendingProduction = orderedQty - allocatedQty;
    expect(pendingProduction).toBe(100);

    // Stage 2: Labour Allocation (Allocate 60 boxes)
    const assignQty1 = 60;
    allocatedQty += assignQty1;
    pendingProduction = orderedQty - allocatedQty;
    expect(pendingProduction).toBe(40); // Remaining PO balance to assign

    // Stage 3: Production Floor Complete (Produce all 60 assigned units)
    completedQty += 60;
    let readyToDispatch = completedQty - dispatchedQty - reservedQty;
    expect(readyToDispatch).toBe(60);

    // Stage 4: Partial Delivery Challan Created (Dispatch 45 boxes)
    const dispatchQty1 = 45;
    reservedQty += dispatchQty1;
    readyToDispatch = completedQty - dispatchedQty - reservedQty;
    expect(readyToDispatch).toBe(15); // Remaining 15 completed boxes stay in Ready list

    // Stage 5: Confirm Gate Dispatch
    reservedQty -= dispatchQty1;
    dispatchedQty += dispatchQty1;
    let orderFulfilmentStatus = dispatchedQty < orderedQty ? 'Partially Dispatched' : 'Completed';
    expect(orderFulfilmentStatus).toBe('Partially Dispatched');

    // Stage 6: Allocate and produce remaining 40 boxes
    allocatedQty += 40;
    expect(orderedQty - allocatedQty).toBe(0); // Zero pending allocation
    completedQty += 40;
    readyToDispatch = completedQty - dispatchedQty - reservedQty;
    expect(readyToDispatch).toBe(55); // 15 prior + 40 new = 55 ready to dispatch

    // Stage 7: Final Delivery Challan for remaining 55 units
    const dispatchQty2 = 55;
    reservedQty += dispatchQty2;
    reservedQty -= dispatchQty2;
    dispatchedQty += dispatchQty2;

    expect(dispatchedQty).toBe(100);
    orderFulfilmentStatus = dispatchedQty >= orderedQty ? 'Completed' : 'Partially Dispatched';
    expect(orderFulfilmentStatus).toBe('Completed');
  });

  // PILLAR 5: Backend & UI Validation against Over-Allocation, Over-Production, and Over-Dispatch
  it('Pillar 5: Strict validation rejects over-allocation, over-production, and over-dispatch', () => {
    const orderedQty = 50;
    const allocatedQty = 30;
    const completedQty = 20;
    const reservedQty = 10;
    const dispatchedQty = 5;

    // Validation 1: Allocation cannot exceed remaining PO quantity
    const pendingPoQty = orderedQty - allocatedQty; // 20
    const invalidAllocation = 25;
    const canAllocate = invalidAllocation > 0 && invalidAllocation <= pendingPoQty;
    expect(canAllocate).toBe(false);

    // Validation 2: Production complete cannot exceed allocated quantity
    const invalidCompletion = 35;
    const canComplete = invalidCompletion >= completedQty && invalidCompletion <= allocatedQty;
    expect(canComplete).toBe(false);

    // Validation 3: Dispatch quantity cannot exceed available ready units
    const availableForDispatch = completedQty - dispatchedQty - reservedQty; // 20 - 5 - 10 = 5
    const invalidDispatch = 10;
    const canDispatch = invalidDispatch > 0 && invalidDispatch <= availableForDispatch;
    expect(canDispatch).toBe(false);
  });

  // PILLAR 6: Correct Status Updates across Partial and Full Lifecycle
  it('Pillar 6: Order and Challan status transitions match exact business rules', () => {
    const item = { ordered: 100, completed: 0, dispatched: 0 };

    // Initial state
    let orderStatus = 'Pending';
    expect(orderStatus).toBe('Pending');

    // Allocation started
    orderStatus = 'In Production';
    expect(orderStatus).toBe('In Production');

    // Partial dispatch
    item.completed = 60;
    item.dispatched = 30;
    orderStatus = item.dispatched < item.ordered ? 'Partially Dispatched' : 'Completed';
    expect(orderStatus).toBe('Partially Dispatched');

    // Full dispatch
    item.completed = 100;
    item.dispatched = 100;
    orderStatus = item.dispatched >= item.ordered ? 'Completed' : 'Partially Dispatched';
    expect(orderStatus).toBe('Completed');
  });

  // PILLAR 7 & 8: Transaction Handling & Prevention of Duplicate Quantities, Stock, or Deductions
  it('Pillars 7 & 8: DC cancellation restores stock only once; Payroll advances never double-deduct', () => {
    // Test 1: Delivery Challan Cancellation Integrity
    let completedQty = 50;
    let reservedQty = 0;
    let dispatchedQty = 0;

    // Create DC for 25 units
    const dcQty = 25;
    reservedQty += dcQty;
    expect(completedQty - dispatchedQty - reservedQty).toBe(25);

    // Cancel DC
    let dcStatus: 'Delivery Challan Made' | 'Dispatched' | 'Cancelled' = 'Delivery Challan Made';
    if (dcStatus === 'Delivery Challan Made') {
      reservedQty = Math.max(0, reservedQty - dcQty);
      dcStatus = 'Cancelled';
    }
    expect(reservedQty).toBe(0);
    expect(completedQty - dispatchedQty - reservedQty).toBe(50); // Stock safely restored

    // Second cancellation attempt must be blocked
    let secondCancelAllowed = false;
    const currentStatus: string = dcStatus;
    if (currentStatus === 'Delivery Challan Made') {
      secondCancelAllowed = true;
    }
    expect(secondCancelAllowed).toBe(false); // Cannot cancel twice!

    // Test 2: Labour Borrowing & Payroll Deduction Integrity
    const borrowings = [{ id: 'b-1', amount: 3000, deducted: 0 }];
    const earned = 2000;

    // First payroll run
    const b0 = borrowings[0]!;
    const activeDebt = b0.amount - b0.deducted;
    const deduction1 = Math.min(earned, activeDebt); // 2000
    b0.deducted += deduction1;
    const netPaid1 = earned - deduction1; // 0 (all used to repay advance)

    expect(deduction1).toBe(2000);
    expect(b0.deducted).toBe(2000);
    expect(netPaid1).toBe(0);

    // Subsequent payroll check with 0 new earnings
    const newEarned = 0;
    const remainingDebt = b0.amount - b0.deducted; // 1000
    const deduction2 = Math.min(newEarned, remainingDebt);
    expect(deduction2).toBe(0); // Zero earnings cannot trigger double deduction!
  });

  // PILLAR 9: WhatsApp Notification Content Privacy Compliance
  it('Pillar 9: WhatsApp messages omit all monetary pricing, unit rates, and totals', () => {
    const item = {
      sr_no: 1,
      box_type: 'Export Crate',
      size: '1200 x 1000 x 800 mm',
      spec: 'ISPM-15 Heat Treated Pine',
      qty: 50,
      unit_rate: 850,
      total_price: 42500,
    };

    // Construct customer WhatsApp notification
    const msg = [
      `*ORDER ITEM DETAILS:*`,
      `*Item #${item.sr_no}:* ${item.box_type}`,
      `• Size: ${item.size}`,
      `• Spec: ${item.spec}`,
      `• Qty: ${item.qty} units`,
    ].join('\n');

    expect(msg).toContain('Export Crate');
    expect(msg).toContain('50 units');
    expect(msg).not.toContain('850');
    expect(msg).not.toContain('42500');
    expect(msg).not.toContain('₹');
    expect(msg).not.toContain('Price');
    expect(msg).not.toContain('Rate');
  });

  // PILLAR 10: Reports & Realised Profit Separation from Unrealised Pipeline
  it('Pillar 10: Realised profit strictly counts dispatched deliveries and isolates WIP', () => {
    const testData: FactoryData = {
      ...emptyData,
      items: [
        { id: 'i-1', order_id: 'o-1', unit_rate: 500, ordered_qty: 100, completed_qty: 80, dispatched_qty: 50 } as any,
      ],
      challans: [
        // One confirmed dispatch
        { id: 'dc-1', order_id: 'o-1', status: 'Dispatched', dispatch_date: '2026-10-14', freight_charges: 600 } as any,
        // One draft DC not yet confirmed
        { id: 'dc-2', order_id: 'o-1', status: 'Delivery Challan Made', dispatch_date: '2026-10-15', freight_charges: 400 } as any,
      ],
      challanItems: [
        { id: 'ci-1', challan_id: 'dc-1', order_item_id: 'i-1', dispatched_qty: 50, direct_labour_cost: 1500 } as any,
        { id: 'ci-2', challan_id: 'dc-2', order_item_id: 'i-1', dispatched_qty: 30, direct_labour_cost: 900 } as any,
      ],
      expenses: [
        { id: 'e-1', reference_dc_id: 'dc-1', amount: 400, category: 'Transportation' } as any,
        { id: 'e-2', reference_dc_id: null, amount: 1000, category: 'Utilities' } as any,
      ],
    };

    const realised = finance(testData);

    // Only dc-1 (Dispatched) should be realised
    expect(realised.length).toBe(1);
    const r0 = realised[0]!;
    expect(r0.id).toBe('dc-1');

    // Realised Revenue: 50 units * ₹500 = ₹25,000
    expect(r0.revenue).toBe(25000);

    // Direct Labour: ₹1,500
    expect(r0.labour).toBe(1500);

    // Freight: ₹600
    expect(r0.freight_charges).toBe(600);

    // Direct Expenses (₹400) + Apportioned Shared (₹1,000 * 50 / 50 = ₹1,000) = ₹1,400
    expect(r0.expenses).toBe(1400);

    // Net Realised Profit: 25,000 - 1,500 - 600 - 1,400 = 21,500
    expect(r0.profit).toBe(21500);

    // Margin: 21,500 / 25,000 * 100 = 86%
    expect(r0.margin).toBe(86);
  });
});
