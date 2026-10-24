import {VolumeCharts} from './volume-charts';
import {useState, useEffect, useMemo} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog, DialogContent, DialogTitle} from '@/components/ui/dialog';
import {useFactory} from './provider';
import {Empty, Pill, Pagination, DateFilterPill, FilterToken, ExportButton, ThemedSelect, ThemedDatePicker, clearModalSearchParams, ViewTabs, SearchFilter, WhatsAppIcon} from './common';
import {money, number, dateLabel, downloadCsv, today, formatLocalDate, type Row} from '@/lib/erp-data';
import {Truck, Plus, Pencil, Trash2, CheckCircle2, UserCheck, Calendar, Users, Scissors, Wrench, AlertCircle, HelpCircle, Wallet, ArrowUpRight, Check, X} from 'lucide-react';
import {supabase} from '@/integrations/supabase/client';
import {toast} from 'sonner';

type LabourCategoryTab = 'contract' | 'transport' | 'helper';

interface AttendanceEntry {
  status: 'Present' | 'Half Day' | 'Absent';
  remarks: string;
}

export function Labour(){
  const {data:d, action, isAdmin, hasCapability, refresh} = useFactory();
  const canRecordPayment = isAdmin || hasCapability('record_payment') || hasCapability('run_payroll');
  const [activeTab, setActiveTab] = useState<LabourCategoryTab>('contract');

  // ============================================================================
  // WORKER SEGMENTATION BY CATEGORY
  // ============================================================================
  const transportWorkers = useMemo(() => d.workers.filter(w => 
    w.labour_category === 'transport' ||
    (w as any).department === 'Transport' || 
    Boolean((w as any).vehicle_number) ||
    (w.unit_assignment && w.unit_assignment.toLowerCase().includes('transport'))
  ), [d.workers]);

  const helperWorkers = useMemo(() => d.workers.filter(w => 
    w.labour_category === 'helper'
  ), [d.workers]);

  const loaderWorkers = useMemo(() => d.workers.filter(w => 
    w.labour_category === 'loader'
  ), [d.workers]);

  const contractWorkers = useMemo(() => d.workers.filter(w => 
    !transportWorkers.some(tw => tw.id === w.id) &&
    !helperWorkers.some(hw => hw.id === w.id) &&
    !loaderWorkers.some(lw => lw.id === w.id)
  ), [d.workers, transportWorkers, helperWorkers, loaderWorkers]);

  // ============================================================================
  // CONTRACT LABOUR STATE
  // ============================================================================
  const [contractSearch, setContractSearch] = useState('');
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [editingContractWorker, setEditingContractWorker] = useState<Row<'labour_master'> | null>(null);
  const [contractBusy, setContractBusy] = useState(false);

  // Productivity Tracking
  const [allocWorkerId, setAllocWorkerId] = useState('All');
  const [prodRange, setProdRange] = useState<'All' | 'Today' | 'Yesterday' | 'Week' | 'Month' | 'Exact' | 'Custom'>('All');
  const [prodSpecificDate, setProdSpecificDate] = useState('');
  const [prodCustomFrom, setProdCustomFrom] = useState('');
  const [prodCustomTo, setProdCustomTo] = useState('');
  const [allocPage, setAllocPage] = useState(1);
  const [selected, setSelected] = useState<Row<'production_allocations'> | null>(null);

  // Contract Ledger & Payroll
  const [contractLedgerMode, setContractLedgerMode] = useState<'all_time' | 'date_filtered'>('all_time');
  const [contractLedgerSearch, setContractLedgerSearch] = useState('');
  const [contractLedgerPage, setContractLedgerPage] = useState(1);

  // ============================================================================
  // TRANSPORT LABOUR STATE
  // ============================================================================
  const [transportSearch, setTransportSearch] = useState('');
  const [transportModalOpen, setTransportModalOpen] = useState(false);
  const [editingTransporter, setEditingTransporter] = useState<Row<'labour_master'> | null>(null);
  const [transportBusy, setTransportBusy] = useState(false);
  const [transportPage, setTransportPage] = useState(1);
  const [selectedTransporterFilter, setSelectedTransporterFilter] = useState('All');
  const [challanPage, setChallanPage] = useState(1);

  // ============================================================================
  // HELPER LABOUR & ATTENDANCE STATE
  // ============================================================================
  const [helperSearch, setHelperSearch] = useState('');
  const [helperModalOpen, setHelperModalOpen] = useState(false);
  const [editingHelper, setEditingHelper] = useState<Row<'labour_master'> | null>(null);
  const [helperBusy, setHelperBusy] = useState(false);
  const [helperPage, setHelperPage] = useState(1);

  // Daily Attendance Register state
  const [attendanceDate, setAttendanceDate] = useState(today());
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, AttendanceEntry>>({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceMonthFilter, setAttendanceMonthFilter] = useState<'This Month' | 'Last 30 Days' | 'All'>('This Month');

  // Load attendance draft whenever attendanceDate or helper list changes
  useEffect(() => {
    const existing = (d.attendance || []).filter(a => a.attendance_date === attendanceDate);
    const draft: Record<string, AttendanceEntry> = {};
    helperWorkers.forEach(h => {
      const match = existing.find(e => e.helper_id === h.id);
      if (match) {
        draft[h.id] = { status: match.status, remarks: match.remarks || '' };
      } else {
        draft[h.id] = { status: 'Present', remarks: '' };
      }
    });
    setAttendanceDraft(draft);
  }, [attendanceDate, helperWorkers, d.attendance]);

  function updateHelperAttendance(helperId: string, patch: Partial<AttendanceEntry>) {
    setAttendanceDraft(prev => {
      const current = prev[helperId] || { status: 'Present', remarks: '' };
      return {
        ...prev,
        [helperId]: {
          status: patch.status ?? current.status,
          remarks: patch.remarks !== undefined ? patch.remarks : current.remarks
        }
      };
    });
  }

  // ============================================================================
  // SHARED MODALS (Borrowing, Statement, Disbursement, Payroll History)
  // ============================================================================
  const [statementWorker, setStatementWorker] = useState<Row<'labour_master'> | null>(null);
  const [statementRange, setStatementRange] = useState<'All' | 'Today' | 'Yesterday' | 'Week' | 'Month'>('All');
  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [borrowLabourId, setBorrowLabourId] = useState('');
  const [paymentModalPayroll, setPaymentModalPayroll] = useState<Row<'labour_payroll'> | null>(null);
  const [busy, setBusy] = useState(false);

  // Payroll date-wise report state
  const [historyPage, setHistoryPage] = useState(1);
  const [payrollFrom, setPayrollFrom] = useState('');
  const [payrollTo, setPayrollTo] = useState('');
  const [payrollStatus, setPayrollStatus] = useState('All');
  const [payrollWorkerId, setPayrollWorkerId] = useState('All');

  const pageSize = 10;
  const now = new Date();
  const todayStr = formatLocalDate(now);
  const yesterdayDate = new Date(now.getTime() - 86400000);
  const yesterdayStr = formatLocalDate(yesterdayDate);

  // ============================================================================
  // CONTRACT LABOUR PRODUCTIVITY CALCULATIONS
  // ============================================================================
  const filteredAllocations = contractWorkers.length ? d.allocations.filter(a => {
    if (allocWorkerId !== 'All' && a.labour_id !== allocWorkerId) return false;
    const aDateStr = a.start_time ? a.start_time.slice(0, 10) : '';
    if (prodRange === 'All') return true;
    if (prodRange === 'Exact') return prodSpecificDate ? aDateStr === prodSpecificDate : true;
    if (prodRange === 'Today') return aDateStr === todayStr;
    if (prodRange === 'Yesterday') return aDateStr === yesterdayStr;
    if (prodRange === 'Week') {
      const date = new Date(a.start_time);
      return (now.getTime() - date.getTime()) <= 7 * 86400000;
    }
    if (prodRange === 'Month') {
      const date = new Date(a.start_time);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    if (prodRange === 'Custom') {
      if (prodCustomFrom && aDateStr < prodCustomFrom) return false;
      if (prodCustomTo && aDateStr > prodCustomTo) return false;
      return true;
    }
    return true;
  }) : [];

  const totalAssigned = filteredAllocations.reduce((s, a) => s + a.allocated_qty, 0);
  const totalCompleted = filteredAllocations.reduce((s, a) => s + a.completed_qty, 0);
  const totalEarnedForPeriod = filteredAllocations.reduce((s, a) => s + (a.completed_qty * (a.labour_rate || 0)), 0);
  const totalUnpaidForPeriod = filteredAllocations.reduce((s, a) => s + Math.max(0, (a.completed_qty * (a.labour_rate || 0)) - (a.paid_earnings || 0)), 0);
  const totalPending = Math.max(0, totalAssigned - totalCompleted);
  const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  const paginatedAllocations = filteredAllocations.slice((allocPage - 1) * pageSize, allocPage * pageSize);

  // Contract workers ledger
  const filteredContractLedger = contractWorkers.filter(w => {
    if (!contractLedgerSearch) return true;
    const q = contractLedgerSearch.toLowerCase();
    return (w.labour_name || '').toLowerCase().includes(q) || (w.unit_assignment || '').toLowerCase().includes(q) || (w.working_type || '').toLowerCase().includes(q);
  });
  const paginatedContractWorkers = filteredContractLedger.slice((contractLedgerPage - 1) * pageSize, contractLedgerPage * pageSize);

  // ============================================================================
  // TRANSPORT LABOUR CALCULATIONS
  // ============================================================================
  const filteredTransportWorkers = transportWorkers.filter(w => {
    const q = transportSearch.toLowerCase();
    const name = (w.labour_name || '').toLowerCase();
    const veh = (w.vehicle_number || '').toLowerCase();
    const vehName = (w.vehicle_name || '').toLowerCase();
    const phone = (w.phone || '').toLowerCase();
    return name.includes(q) || veh.includes(q) || vehName.includes(q) || phone.includes(q);
  });
  const paginatedTransport = filteredTransportWorkers.slice((transportPage - 1) * pageSize, transportPage * pageSize);

  // Transport Challans
  const transportChallans = d.challans.filter(c => {
    if (selectedTransporterFilter !== 'All') {
      const worker = transportWorkers.find(tw => tw.id === selectedTransporterFilter);
      if (!worker) return false;
      return c.transporter_id === worker.id || c.transport_carrier === worker.labour_name || (worker.vehicle_number && c.vehicle_number === worker.vehicle_number);
    }
    return true;
  });
  const paginatedTransportChallans = transportChallans.slice((challanPage - 1) * pageSize, challanPage * pageSize);
  const totalFreightDispatched = transportChallans.reduce((s, c) => s + (c.freight_charges || 0), 0);

  // ============================================================================
  // HELPER LABOUR & ATTENDANCE CALCULATIONS
  // ============================================================================
  const filteredHelpers = helperWorkers.filter(w => {
    const q = helperSearch.toLowerCase();
    return (w.labour_name || '').toLowerCase().includes(q) || (w.phone || '').toLowerCase().includes(q) || (w.unit_assignment || '').toLowerCase().includes(q);
  });
  const paginatedHelpers = filteredHelpers.slice((helperPage - 1) * pageSize, helperPage * pageSize);

  // Helper Attendance range calculations
  const helperAttendanceStats = useMemo(() => {
    const stats: Record<string, { present: number; halfDay: number; absent: number; totalDays: number; grossWages: number; unpaidWages: number }> = {};
    const attendanceRecords = d.attendance || [];
    
    helperWorkers.forEach(h => {
      let workerRecords = attendanceRecords.filter(a => a.helper_id === h.id);
      if (attendanceMonthFilter === 'This Month') {
        const currentMonth = now.toISOString().slice(0, 7);
        workerRecords = workerRecords.filter(a => a.attendance_date.startsWith(currentMonth));
      } else if (attendanceMonthFilter === 'Last 30 Days') {
        const threshold = formatLocalDate(new Date(now.getTime() - 30 * 86400000));
        workerRecords = workerRecords.filter(a => a.attendance_date >= threshold);
      }

      let present = 0;
      let halfDay = 0;
      let absent = 0;
      let grossWages = 0;
      let unpaidWages = 0;

      workerRecords.forEach(r => {
        if (r.status === 'Present') {
          present += 1;
          grossWages += r.wage_rate || h.daily_rate;
        } else if (r.status === 'Half Day') {
          halfDay += 1;
          grossWages += (r.wage_rate || h.daily_rate) * 0.5;
        } else if (r.status === 'Absent') {
          absent += 1;
        }
        unpaidWages += Math.max(0, (r.calculated_wage || 0) - (r.paid_wage || 0));
      });

      stats[h.id] = {
        present,
        halfDay,
        absent,
        totalDays: present + (halfDay * 0.5),
        grossWages,
        unpaidWages
      };
    });

    return stats;
  }, [helperWorkers, d.attendance, attendanceMonthFilter]);

  // ============================================================================
  // PAYROLL REPORT CALCULATIONS
  // ============================================================================
  const filteredPayroll = d.payroll.filter(p => {
    const pDate = p.payout_date ? p.payout_date.slice(0, 10) : (p.created_at ? p.created_at.slice(0, 10) : '');
    if (payrollFrom && pDate && pDate < payrollFrom) return false;
    if (payrollTo && pDate && pDate > payrollTo) return false;
    const statusVal = p.status ?? 'Pending';
    if (payrollStatus !== 'All' && statusVal !== payrollStatus) return false;
    if (payrollWorkerId !== 'All' && p.labour_id !== payrollWorkerId) return false;
    return true;
  });

  const totalPayrollGross = filteredPayroll.reduce((s, p) => s + p.gross, 0);
  const totalPayrollDeductions = filteredPayroll.reduce((s, p) => s + p.deductions, 0);
  const totalPayrollNetPaid = filteredPayroll.reduce((s, p) => s + p.net_paid, 0);
  const paginatedPayroll = filteredPayroll.slice((historyPage - 1) * pageSize, historyPage * pageSize);

  // ============================================================================
  // SAVE CONTRACT LABOUR
  // ============================================================================
  async function saveContractWorker(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setContractBusy(true);
    const f = new FormData(e.currentTarget);
    const name = String(f.get('labour_name') || '').trim();
    const workingType = String(f.get('working_type') || 'Cutting');
    const unit = String(f.get('unit_assignment') || '').trim();
    const phone = String(f.get('phone') || '').trim();

    if (!name) {
      toast.error('Worker or Unit name is required.');
      setContractBusy(false);
      return;
    }

    const payload: any = {
      labour_name: name,
      labour_category: 'contract',
      working_type: workingType,
      unit_assignment: unit || `${workingType} Unit`,
      phone: phone,
      department: 'Production'
    };

    let error;
    if (editingContractWorker) {
      const res = await (supabase.from as any)('labour_master').update(payload).eq('id', editingContractWorker.id);
      error = res.error;
    } else {
      const res = await (supabase.from as any)('labour_master').insert(payload);
      error = res.error;
    }

    setContractBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editingContractWorker ? 'Contract worker updated successfully' : 'Contract worker / team registered');
    setContractModalOpen(false);
    setEditingContractWorker(null);
    await refresh();
  }

  // ============================================================================
  // SAVE TRANSPORT LABOUR
  // ============================================================================
  async function saveTransporter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTransportBusy(true);
    const f = new FormData(e.currentTarget);
    const name = String(f.get('labour_name') || '').trim();
    const vehicle = String(f.get('vehicle_number') || '').trim();
    const vehicleName = String(f.get('vehicle_name') || '').trim();
    const freight = Math.max(0, Number(f.get('fixed_freight_charges')) || 0);
    const phone = String(f.get('phone') || '').trim();
    const unit = String(f.get('unit_assignment') || '').trim() || `Transport • ${vehicle}`;

    if (!name) {
      toast.error('Transporter / Labour name is required');
      setTransportBusy(false);
      return;
    }
    if (!vehicle) {
      toast.error('Vehicle registration number is required');
      setTransportBusy(false);
      return;
    }

    const payload: any = {
      labour_name: name,
      phone: phone,
      vehicle_number: vehicle,
      vehicle_name: vehicleName || 'Carrier Vehicle',
      fixed_freight_charges: freight,
      daily_rate: freight,
      labour_category: 'transport',
      department: 'Transport',
      unit_assignment: unit
    };

    let error;
    if (editingTransporter) {
      const res = await (supabase.from as any)('labour_master').update(payload).eq('id', editingTransporter.id);
      error = res.error;
    } else {
      const res = await (supabase.from as any)('labour_master').insert(payload);
      error = res.error;
    }

    setTransportBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editingTransporter ? 'Transporter updated' : 'Transporter registered successfully');
    setTransportModalOpen(false);
    setEditingTransporter(null);
    await refresh();
  }

  // ============================================================================
  // SAVE HELPER LABOUR
  // ============================================================================
  async function saveHelper(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHelperBusy(true);
    const f = new FormData(e.currentTarget);
    const name = String(f.get('labour_name') || '').trim();
    const dailyRate = Math.max(0, Number(f.get('daily_rate')) || 0);
    const phone = String(f.get('phone') || '').trim();
    const unit = String(f.get('unit_assignment') || '').trim();

    if (!name) {
      toast.error('Helper name is required');
      setHelperBusy(false);
      return;
    }
    if (dailyRate <= 0) {
      toast.error('Please enter a valid daily wage rate (₹)');
      setHelperBusy(false);
      return;
    }

    const payload: any = {
      labour_name: name,
      phone: phone,
      daily_rate: dailyRate,
      labour_category: 'helper',
      department: 'Helper Line',
      unit_assignment: unit || 'General Helper'
    };

    let error;
    if (editingHelper) {
      const res = await (supabase.from as any)('labour_master').update(payload).eq('id', editingHelper.id);
      error = res.error;
    } else {
      const res = await (supabase.from as any)('labour_master').insert(payload);
      error = res.error;
    }

    setHelperBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editingHelper ? 'Helper updated successfully' : 'Helper registered successfully');
    setHelperModalOpen(false);
    setEditingHelper(null);
    await refresh();
  }

  // ============================================================================
  // RECORD DAILY ATTENDANCE FOR HELPERS
  // ============================================================================
  async function saveDailyAttendance() {
    if (!helperWorkers.length) {
      toast.info('No helpers registered yet. Add a helper first.');
      return;
    }
    setAttendanceSaving(true);
    const records = helperWorkers.map(h => ({
      helper_id: h.id,
      status: attendanceDraft[h.id]?.status ?? 'Present',
      wage_rate: h.daily_rate || 0,
      remarks: attendanceDraft[h.id]?.remarks ?? ''
    }));

    const ok = await action('record_attendance', {
      attendance_date: attendanceDate,
      records
    });
    setAttendanceSaving(false);
    if (ok) {
      toast.success(`Daily attendance recorded for ${dateLabel(attendanceDate)}`);
      await refresh();
    }
  }

  function markAllHelpers(status: 'Present' | 'Half Day' | 'Absent') {
    const updated: Record<string, AttendanceEntry> = {};
    helperWorkers.forEach(h => {
      updated[h.id] = {
        status,
        remarks: attendanceDraft[h.id]?.remarks || ''
      };
    });
    setAttendanceDraft(updated);
  }

  // ============================================================================
  // COMMON WORKFLOW ACTIONS (Completion, Borrowing, Payment, Delete)
  // ============================================================================
  async function complete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    const qty = Number(new FormData(e.currentTarget).get('completed_qty'));
    if (await action('complete', { id: selected.id, completed_qty: qty })) setSelected(null);
    setBusy(false);
  }

  async function recordBorrowing(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const ok = await action('borrow', {
      labour_id: String(f.get('labour_id')),
      borrow_date: String(f.get('borrow_date')),
      amount: Number(f.get('amount')),
      remarks: String(f.get('remarks') ?? '')
    });
    setBusy(false);
    if (ok) setBorrowModalOpen(false);
  }

  async function recordPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!paymentModalPayroll) return;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const amount = Number(f.get('amount'));
    const mode = String(f.get('payment_mode') || 'Cash');
    const date = String(f.get('disbursed_at') || new Date().toISOString());
    const ref = String(f.get('reference_notes') || '');
    const ok = await action('disburse', {
      payroll_id: paymentModalPayroll.id,
      amount,
      payment_mode: mode,
      disbursed_at: date,
      reference_notes: ref
    });
    setBusy(false);
    if (ok) setPaymentModalPayroll(null);
  }

  async function deleteWorker(w: Row<'labour_master'>, label: string) {
    if (!window.confirm(`Are you sure you want to delete ${label} "${w.labour_name}"? This cannot be undone.`)) return;
    const rpcRes = await (supabase.rpc as any)('soft_delete_record', {
      target_table: 'labour_master',
      target_id: w.id
    });
    let error = rpcRes.error;
    if (error) {
      const { error: directErr } = await (supabase.from as any)('labour_master').delete().eq('id', w.id);
      error = directErr;
    }
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${label} removed successfully`);
    await refresh();
  }

  return (
    <>
      {/* Category Navigation Tabs */}
      <div className="mb-6">
        <ViewTabs
          tabs={[
            { id: 'contract', label: '1. Contract Labour (Piece-Rate)', count: contractWorkers.length },
            { id: 'transport', label: '2. Transport Labour (Challan-Wise)', count: transportWorkers.length },
            { id: 'helper', label: '3. Helper Labour (Daily Wage + Attendance)', count: helperWorkers.length },
            // Note: Loaders is commented and hidden for now per client discussion:
            // { id: 'loaders', label: '4. Loaders (Discussion)', count: loaderWorkers.length },
          ]}
          active={activeTab}
          onChange={t => setActiveTab(t as LabourCategoryTab)}
        />
      </div>

      {/* ====================================================================== */}
      {/* 1. CONTRACT LABOUR DEPARTMENT */}
      {/* ====================================================================== */}
      {activeTab === 'contract' && (
        <div className="space-y-6">
          {/* Header & Registration */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Scissors className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Contract Labour Management</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setBorrowLabourId(contractWorkers[0]?.id ?? '');
                  setBorrowModalOpen(true);
                }}
              >
                Record Advance
              </Button>
              <Button
                onClick={() => {
                  setEditingContractWorker(null);
                  setContractModalOpen(true);
                }}
                className="flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Register Contract Worker / Team
              </Button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-sm font-semibold text-muted-foreground block">Registered Workers / Teams</span>
              <strong className="text-2xl sm:text-3xl font-extrabold text-foreground mt-1 block">{contractWorkers.length}</strong>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-sm font-semibold text-muted-foreground block">Assigned Boxes</span>
              <strong className="text-2xl sm:text-3xl font-extrabold text-foreground mt-1 block">{number(totalAssigned)}</strong>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-sm font-semibold text-muted-foreground block">Boxes Completed</span>
              <strong className="text-2xl sm:text-3xl font-extrabold text-emerald-500 mt-1 block">{number(totalCompleted)}</strong>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-sm font-semibold text-muted-foreground block">Earned Piece Wages</span>
              <strong className="text-2xl sm:text-3xl font-extrabold text-emerald-500 mt-1 block">{money(totalEarnedForPeriod)}</strong>
            </div>
          </div>

          {/* Registered Contract Workers List */}
          <section className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <h3 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2.5">
                <Users className="w-5 h-5 text-primary" /> Active Contract Workers & Units
              </h3>
              <SearchFilter
                value={contractSearch}
                onChange={setContractSearch}
                placeholder="Search worker or unit name…"
              />
            </div>
            <div className="desktop-table-view table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Worker / Unit Name</th>
                    <th>Working Type</th>
                    <th>Unit / Machine Assignment</th>
                    <th>Phone</th>
                    <th className="numeric">Active Tasks</th>
                    <th className="w-24 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contractWorkers.filter(w => (w.labour_name || '').toLowerCase().includes(contractSearch.toLowerCase())).length ? (
                    contractWorkers.filter(w => (w.labour_name || '').toLowerCase().includes(contractSearch.toLowerCase())).map(w => {
                      const activeTasks = d.allocations.filter(a => a.labour_id === w.id && a.completed_qty < a.allocated_qty).length;
                      return (
                        <tr key={w.id}>
                          <td className="font-medium text-foreground">{w.labour_name}</td>
                          <td>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-foreground">
                              {w.working_type || 'Cutting'}
                            </span>
                          </td>
                          <td className="text-muted-foreground text-xs">{w.unit_assignment || '—'}</td>
                          <td className="text-muted-foreground text-xs">{w.phone || '—'}</td>
                          <td className="numeric font-medium">{activeTasks}</td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  setEditingContractWorker(w);
                                  setContractModalOpen(true);
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon-sm"
                                onClick={() => deleteWorker(w, 'Contract worker')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <Empty columns={6} label="No contract workers registered. Click 'Register Contract Worker' above." />
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Production Allocations & Piece-rate Productivity */}
          <section className="bg-card border border-border rounded-xl p-5">
            <div className="section-header flex items-center justify-between gap-4 flex-wrap mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-foreground">Allocated Work & Item-wise Piece Rate</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <FilterToken
                  label="Worker"
                  value={allocWorkerId}
                  onChange={v => { setAllocWorkerId(v); setAllocPage(1); }}
                  options={[
                    { value: 'All', label: 'All Workers' },
                    ...contractWorkers.map(w => ({ value: w.id, label: w.labour_name }))
                  ]}
                />
                <div className="flex items-center gap-1 bg-secondary/50 border border-border p-0.5 rounded-lg text-xs h-8">
                  {(['All', 'Today', 'Yesterday', 'Week', 'Month', 'Exact', 'Custom'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${prodRange === r ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                      onClick={() => {
                        setProdRange(r);
                        if (r === 'Exact' && !prodSpecificDate) setProdSpecificDate(today());
                        setAllocPage(1);
                      }}
                    >
                      {r === 'All' ? 'All Time' : r === 'Exact' ? 'Pick Date' : r === 'Custom' ? 'Custom Range' : r === 'Week' ? 'This Week' : r === 'Month' ? 'This Month' : r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="desktop-table-view table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Worker / Team</th>
                    <th>Order #</th>
                    <th>Product Type / Material</th>
                    <th className="numeric">Assigned</th>
                    <th className="numeric">Produced</th>
                    <th className="numeric">Rate / Box</th>
                    <th className="numeric">Earned Wage</th>
                    <th className="numeric">Pending</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAllocations.length ? paginatedAllocations.map(a => {
                    const item = d.items.find(i => i.id === a.order_item_id);
                    const order = item ? d.orders.find(o => o.id === item.order_id) : null;
                    const worker = contractWorkers.find(w => w.id === a.labour_id);
                    const pending = Math.max(0, a.allocated_qty - a.completed_qty);
                    const earned = a.completed_qty * (a.labour_rate || 0);

                    return (
                      <tr key={a.id}>
                        <td className="font-semibold text-foreground text-sm sm:text-base">{worker?.labour_name || 'Worker'}</td>
                        <td className="text-sm text-muted-foreground font-medium font-mono">{order?.order_no || '—'}</td>
                        <td>
                          <div className="font-semibold text-sm sm:text-base">{item?.box_type || '—'}</div>
                          {item?.specification && <div className="text-xs text-muted-foreground">{item.specification}</div>}
                        </td>
                        <td className="numeric font-medium text-sm sm:text-base">{number(a.allocated_qty)}</td>
                        <td className="numeric text-emerald-500 font-semibold text-sm sm:text-base">{number(a.completed_qty)}</td>
                        <td className="numeric font-medium text-foreground text-sm sm:text-base">{money(a.labour_rate)}</td>
                        <td className="numeric text-emerald-500 font-bold text-sm sm:text-base">{money(earned)}</td>
                        <td className="numeric font-medium text-foreground text-sm sm:text-base">{number(pending)}</td>
                        <td><Pill value={a.status}/></td>
                        <td className="text-right">
                          {a.completed_qty < a.allocated_qty && (
                            <Button size="sm" variant="outline" onClick={() => setSelected(a)}>Log Finish</Button>
                          )}
                        </td>
                      </tr>
                    );
                  }) : (
                    <Empty columns={10} label="No allocations match the selected filter." />
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={allocPage}
              totalItems={filteredAllocations.length}
              pageSize={pageSize}
              onPageChange={setAllocPage}
            />
          </section>

          {/* Contract Ledger & Payroll */}
          <section className="bg-card border border-border rounded-xl p-5">
            <div className="section-header flex items-center justify-between gap-4 flex-wrap mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-foreground">Contract Payroll & Worker Ledger</h3>
              <SearchFilter
                value={contractLedgerSearch}
                onChange={v => { setContractLedgerSearch(v); setContractLedgerPage(1); }}
                placeholder="Search worker…"
              />
            </div>

            <div className="desktop-table-view table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Worker / Unit</th>
                    <th className="numeric">Completed Boxes</th>
                    <th className="numeric">Gross Earned</th>
                    <th className="numeric">Outstanding Advances</th>
                    <th className="numeric">Net Payable</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedContractWorkers.length ? paginatedContractWorkers.map(w => {
                    const workerAllocs = d.allocations.filter(a => a.labour_id === w.id);
                    const produced = workerAllocs.reduce((s, a) => s + a.completed_qty, 0);
                    const earnings = workerAllocs.reduce((s, a) => s + (a.completed_qty * (a.labour_rate || 0)) - (a.paid_earnings || 0), 0);
                    const workerBorrowings = d.borrowings.filter(b => b.labour_id === w.id);
                    const debt = workerBorrowings.reduce((s, b) => s + b.amount - b.deducted_amount, 0);
                    const netPayable = Math.max(0, earnings - debt);

                    return (
                      <tr key={w.id}>
                        <td className="font-semibold text-foreground">
                          <div className="text-sm sm:text-base font-bold">{w.labour_name}</div>
                          <span className="text-xs text-muted-foreground font-normal">{w.working_type || 'Cutting'} · {w.unit_assignment}</span>
                        </td>
                        <td className="numeric font-medium text-sm sm:text-base">{number(produced)}</td>
                        <td className="numeric font-semibold text-emerald-500 text-sm sm:text-base">{money(earnings)}</td>
                        <td className="numeric text-muted-foreground text-sm sm:text-base">{money(debt)}</td>
                        <td className="numeric font-bold text-foreground text-sm sm:text-base">{money(netPayable)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button size="sm" variant="ghost" onClick={() => setStatementWorker(w)}>
                              Statement
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!earnings}
                              onClick={() => {
                                if (window.confirm(`Pay ${money(netPayable)} to ${w.labour_name}?`)) {
                                  action('payroll', { labour_id: w.id });
                                }
                              }}
                            >
                              Pay Payroll
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <Empty columns={6} label="No contract workers match criteria." />
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={contractLedgerPage}
              totalItems={filteredContractLedger.length}
              pageSize={pageSize}
              onPageChange={setContractLedgerPage}
            />
          </section>
        </div>
      )}

      {/* ====================================================================== */}
      {/* 2. TRANSPORT LABOUR DEPARTMENT */}
      {/* ====================================================================== */}
      {activeTab === 'transport' && (
        <div className="space-y-6">
          {/* Header & Registration */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Transport Labour & Transporters</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setBorrowLabourId(transportWorkers[0]?.id ?? '');
                  setBorrowModalOpen(true);
                }}
              >
                Record Advance
              </Button>
              <Button
                onClick={() => {
                  setEditingTransporter(null);
                  setTransportModalOpen(true);
                }}
                className="flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Register Transporter / Driver
              </Button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-sm font-semibold text-muted-foreground block">Registered Transporters</span>
              <strong className="text-2xl sm:text-3xl font-extrabold text-foreground mt-1 block">{transportWorkers.length}</strong>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-sm font-semibold text-muted-foreground block">Fleet Vehicles</span>
              <strong className="text-2xl sm:text-3xl font-extrabold text-primary mt-1 block">
                {new Set(transportWorkers.map(w => w.vehicle_number).filter(Boolean)).size}
              </strong>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-sm font-semibold text-muted-foreground block">Delivered Challans</span>
              <strong className="text-2xl sm:text-3xl font-extrabold text-emerald-500 mt-1 block">
                {d.challans.filter(c => c.status === 'Dispatched' && transportWorkers.some(tw => tw.id === c.transporter_id || tw.labour_name === c.transport_carrier)).length}
              </strong>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-sm font-semibold text-muted-foreground block">Total Transport Charges Earned</span>
              <strong className="text-2xl sm:text-3xl font-extrabold text-emerald-500 mt-1 block">{money(totalFreightDispatched)}</strong>
            </div>
          </div>

          {/* Registered Transporters Table */}
          <section className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <h3 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2.5">
                <Truck className="w-5 h-5 text-primary" /> Registered Drivers & Vehicles
              </h3>
              <SearchFilter
                value={transportSearch}
                onChange={v => { setTransportSearch(v); setTransportPage(1); }}
                placeholder="Search driver, vehicle #, or phone…"
              />
            </div>

            <div className="desktop-table-view table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Driver / Transporter</th>
                    <th>Vehicle Type & Number</th>
                    <th className="numeric">Default Trip Transport Charge</th>
                    <th>Phone</th>
                    <th className="numeric">Delivered Challans</th>
                    <th className="numeric">Net Payable Transport Charge</th>
                    <th className="w-24 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransport.length ? paginatedTransport.map(w => {
                    const vehicle = w.vehicle_number;
                    const freight = w.fixed_freight_charges ?? w.daily_rate ?? 0;
                    const workerChallans = d.challans.filter(c => 
                      c.status === 'Dispatched' && 
                      (c.transporter_id === w.id || c.transport_carrier === w.labour_name || (vehicle && c.vehicle_number === vehicle))
                    );
                    const challanCount = workerChallans.length;
                    const totalEarnedFreight = workerChallans.reduce((s, c) => s + (c.freight_charges || 0) - (c.paid_freight || 0), 0);
                    const debt = d.borrowings.filter(b => b.labour_id === w.id).reduce((s, b) => s + b.amount - b.deducted_amount, 0);
                    const netPayable = Math.max(0, totalEarnedFreight - debt);

                    return (
                      <tr key={w.id}>
                        <td className="font-semibold text-foreground text-sm sm:text-base">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-primary">
                              <Truck className="w-4 h-4" />
                            </div>
                            <span className="font-bold">{w.labour_name}</span>
                          </div>
                        </td>
                        <td>
                          <div className="font-mono font-bold text-sm text-foreground uppercase">
                            {vehicle || '—'}
                          </div>
                          {w.vehicle_name && <div className="text-xs text-muted-foreground">{w.vehicle_name}</div>}
                        </td>
                        <td className="numeric font-bold text-foreground text-sm sm:text-base">{money(freight)}</td>
                        <td>
                          {w.phone ? (
                            <div className="flex items-center gap-2">
                              <a href={`tel:${w.phone}`} className="text-primary hover:underline font-mono text-sm">{w.phone}</a>
                              <a href={`https://wa.me/${w.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-emerald-500 hover:text-emerald-400">
                                <WhatsAppIcon className="w-4 h-4" />
                              </a>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="numeric font-medium">
                          {challanCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {challanCount}
                            </span>
                          ) : '0'}
                        </td>
                        <td className="numeric font-bold text-foreground">{money(netPayable)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!totalEarnedFreight}
                              onClick={() => {
                                if (window.confirm(`Settle transport payout of ${money(netPayable)} for ${w.labour_name}?`)) {
                                  action('payroll', { labour_id: w.id });
                                }
                              }}
                            >
                              Pay Transport Charge
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setEditingTransporter(w);
                                setTransportModalOpen(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon-sm"
                              onClick={() => deleteWorker(w, 'Transporter')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <Empty columns={7} label="No transport labour registered yet. Click 'Register Transporter' above." />
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={transportPage}
              totalItems={filteredTransportWorkers.length}
              pageSize={pageSize}
              onPageChange={setTransportPage}
            />
          </section>

          {/* Person-wise Delivery Challan & Transport Charges Breakdown */}
          <section className="bg-card border border-border rounded-xl p-5">
            <div className="section-header flex items-center justify-between gap-4 flex-wrap mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-foreground">Person-Wise Delivery Challan & Transport Charge Records</h3>
              <FilterToken
                label="Transporter"
                value={selectedTransporterFilter}
                onChange={v => { setSelectedTransporterFilter(v); setChallanPage(1); }}
                options={[
                  { value: 'All', label: 'All Transporters' },
                  ...transportWorkers.map(w => ({ value: w.id, label: `${w.labour_name} (${w.vehicle_number || 'Vehicle'})` }))
                ]}
              />
            </div>

            <div className="desktop-table-view table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Challan #</th>
                    <th>Dispatch Date</th>
                    <th>Transporter / Driver</th>
                    <th>Vehicle Number</th>
                    <th>Party / Client</th>
                    <th className="numeric">Trip Transport Charge (₹)</th>
                    <th>Challan Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransportChallans.length ? paginatedTransportChallans.map(c => {
                    const order = d.orders.find(o => o.id === c.order_id);
                    const party = order?.is_self_stock ? 'Self Stocking' : d.parties.find(p => p.id === order?.party_id)?.company_name ?? '—';
                    const driver = transportWorkers.find(tw => tw.id === c.transporter_id)?.labour_name || c.transport_carrier || '—';

                    return (
                      <tr key={c.id}>
                        <td className="font-mono font-medium text-foreground">{c.challan_number}</td>
                        <td className="text-xs text-muted-foreground">{dateLabel(c.dispatch_date)}</td>
                        <td className="font-medium text-foreground">{driver}</td>
                        <td className="font-mono text-xs uppercase text-muted-foreground">{c.vehicle_number || '—'}</td>
                        <td className="text-xs text-foreground font-medium">{party}</td>
                        <td className="numeric font-bold text-emerald-500">{money(c.freight_charges)}</td>
                        <td><Pill value={c.status}/></td>
                      </tr>
                    );
                  }) : (
                    <Empty columns={7} label="No delivery challans recorded for this transporter." />
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={challanPage}
              totalItems={transportChallans.length}
              pageSize={pageSize}
              onPageChange={setChallanPage}
            />
          </section>
        </div>
      )}

      {/* ====================================================================== */}
      {/* 3. HELPER LABOUR DEPARTMENT (Daily Wage + Attendance) */}
      {/* ====================================================================== */}
      {activeTab === 'helper' && (
        <div className="space-y-6">
          {/* Header & Registration */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Helper Labour & Daily Attendance</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setBorrowLabourId(helperWorkers[0]?.id ?? '');
                  setBorrowModalOpen(true);
                }}
              >
                Record Advance
              </Button>
              <Button
                onClick={() => {
                  setEditingHelper(null);
                  setHelperModalOpen(true);
                }}
                className="flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Register Helper
              </Button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-sm font-semibold text-muted-foreground block">Active Helpers</span>
              <strong className="text-2xl sm:text-3xl font-extrabold text-foreground mt-1 block">{helperWorkers.length}</strong>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-sm font-semibold text-muted-foreground block">Avg Daily Wage Rate</span>
              <strong className="text-2xl sm:text-3xl font-extrabold text-primary mt-1 block">
                {helperWorkers.length ? money(Math.round(helperWorkers.reduce((s, h) => s + (h.daily_rate || 0), 0) / helperWorkers.length)) : money(0)}
              </strong>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-sm font-semibold text-muted-foreground block">Total Days Worked ({attendanceMonthFilter})</span>
              <strong className="text-2xl sm:text-3xl font-extrabold text-emerald-500 mt-1 block">
                {number(Object.values(helperAttendanceStats).reduce((s, st) => s + st.totalDays, 0))} days
              </strong>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-sm font-semibold text-muted-foreground block">Accrued Helper Wages</span>
              <strong className="text-2xl sm:text-3xl font-extrabold text-emerald-500 mt-1 block">
                {money(Object.values(helperAttendanceStats).reduce((s, st) => s + st.grossWages, 0))}
              </strong>
            </div>
          </div>

          {/* Daily Attendance Sheet */}
          <section className="bg-card border border-border rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-primary" /> Daily Attendance Sheet / Muster Roll
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <ThemedDatePicker
                  name="attendance_date"
                  defaultValue={attendanceDate}
                  onChange={v => setAttendanceDate(v || today())}
                />
                <Button variant="outline" size="sm" onClick={() => markAllHelpers('Present')}>
                  Mark All Present
                </Button>
                <Button size="sm" onClick={saveDailyAttendance} disabled={attendanceSaving}>
                  {attendanceSaving ? 'Saving…' : 'Save Attendance'}
                </Button>
              </div>
            </div>

            <div className="desktop-table-view table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Helper Name</th>
                    <th>Daily Rate (₹)</th>
                    <th>Attendance Status ({dateLabel(attendanceDate)})</th>
                    <th className="numeric">Day Wage</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {helperWorkers.length ? helperWorkers.map(h => {
                    const currentStatus = attendanceDraft[h.id]?.status ?? 'Present';
                    const rate = h.daily_rate || 0;
                    const calculated = currentStatus === 'Present' ? rate : currentStatus === 'Half Day' ? rate * 0.5 : 0;

                    return (
                      <tr key={h.id}>
                        <td className="font-semibold text-foreground">
                          <div className="text-sm sm:text-base font-bold">{h.labour_name}</div>
                          <span className="text-xs text-muted-foreground font-normal">{h.unit_assignment || 'General Helper'}</span>
                        </td>
                        <td className="font-semibold text-foreground text-sm sm:text-base">{money(rate)}/day</td>
                        <td>
                          <div className="inline-flex items-center gap-1.5 bg-secondary p-1 rounded-lg">
                            <button
                              type="button"
                              onClick={() => updateHelperAttendance(h.id, { status: 'Present' })}
                              className={`px-3 py-1.5 rounded text-xs sm:text-sm font-semibold transition-all ${
                                currentStatus === 'Present'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              Present (1.0)
                            </button>
                            <button
                              type="button"
                              onClick={() => updateHelperAttendance(h.id, { status: 'Half Day' })}
                              className={`px-3 py-1.5 rounded text-xs sm:text-sm font-semibold transition-all ${
                                currentStatus === 'Half Day'
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              Half Day (0.5)
                            </button>
                            <button
                              type="button"
                              onClick={() => updateHelperAttendance(h.id, { status: 'Absent' })}
                              className={`px-3 py-1.5 rounded text-xs sm:text-sm font-semibold transition-all ${
                                currentStatus === 'Absent'
                                  ? 'bg-red-500 text-white shadow-xs'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              Absent (0)
                            </button>
                          </div>
                        </td>
                        <td className="numeric font-bold text-foreground text-sm sm:text-base">
                          {money(calculated)}
                        </td>
                        <td>
                          <input
                            value={attendanceDraft[h.id]?.remarks ?? ''}
                            onChange={e => updateHelperAttendance(h.id, { remarks: e.target.value })}
                            placeholder="Optional remark…"
                            className="text-sm px-2.5 py-1.5 h-8 rounded border border-border bg-background w-48"
                          />
                        </td>
                      </tr>
                    );
                  }) : (
                    <Empty columns={5} label="No helpers registered yet. Click 'Register Helper' above." />
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Helper Monthly Attendance & Wage Ledger */}
          <section className="bg-card border border-border rounded-xl p-5">
            <div className="section-header flex items-center justify-between gap-4 flex-wrap mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-foreground">Helper Attendance Summary & Payout Ledger</h3>
              <div className="flex items-center gap-2">
                <ThemedSelect
                  name="month_filter"
                  defaultValue={attendanceMonthFilter}
                  onChange={v => setAttendanceMonthFilter(v as any)}
                  options={[
                    { value: 'This Month', label: 'This Month' },
                    { value: 'Last 30 Days', label: 'Last 30 Days' },
                    { value: 'All', label: 'All Time' }
                  ]}
                />
              </div>
            </div>

            <div className="desktop-table-view table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Helper Name</th>
                    <th className="numeric">Daily Rate</th>
                    <th className="numeric">Present Days</th>
                    <th className="numeric">Half Days</th>
                    <th className="numeric">Total Days Worked</th>
                    <th className="numeric">Earned Wages</th>
                    <th className="numeric">Outstanding Advances</th>
                    <th className="numeric">Net Payable</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHelpers.length ? paginatedHelpers.map(h => {
                    const st = helperAttendanceStats[h.id] || { present: 0, halfDay: 0, absent: 0, totalDays: 0, grossWages: 0, unpaidWages: 0 };
                    const debt = d.borrowings.filter(b => b.labour_id === h.id).reduce((s, b) => s + b.amount - b.deducted_amount, 0);
                    const netPayable = Math.max(0, st.unpaidWages - debt);

                    return (
                      <tr key={h.id}>
                        <td className="font-semibold text-foreground">
                          <div className="text-sm sm:text-base font-bold">{h.labour_name}</div>
                          <span className="text-xs text-muted-foreground font-normal">{h.phone || 'No phone'}</span>
                        </td>
                        <td className="numeric font-medium text-sm sm:text-base">{money(h.daily_rate)}</td>
                        <td className="numeric text-emerald-500 font-bold text-sm sm:text-base">{st.present}</td>
                        <td className="numeric text-amber-500 font-semibold text-sm sm:text-base">{st.halfDay}</td>
                        <td className="numeric font-extrabold text-foreground text-sm sm:text-base">{st.totalDays}</td>
                        <td className="numeric font-bold text-emerald-500 text-sm sm:text-base">{money(st.grossWages)}</td>
                        <td className="numeric text-muted-foreground text-sm sm:text-base">{money(debt)}</td>
                        <td className="numeric font-extrabold text-foreground text-sm sm:text-base">{money(netPayable)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!st.unpaidWages}
                              onClick={() => {
                                if (window.confirm(`Disburse helper wage of ${money(netPayable)} to ${h.labour_name}?`)) {
                                  action('payroll', { labour_id: h.id });
                                }
                              }}
                            >
                              Pay Helper
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setEditingHelper(h);
                                setHelperModalOpen(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon-sm"
                              onClick={() => deleteWorker(h, 'Helper')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <Empty columns={9} label="No helpers registered yet." />
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={helperPage}
              totalItems={filteredHelpers.length}
              pageSize={pageSize}
              onPageChange={setHelperPage}
            />
          </section>
        </div>
      )}

      {/* 
      ======================================================================
      4. LOADERS (COMMENTED & HIDDEN FOR NOW PER CLIENT DISCUSSION)
      ======================================================================
      activeTab === 'loaders' && (
        <div className="space-y-6">
          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                Under Client Discussion
              </span>
              <h2 className="text-lg font-semibold text-foreground">Loaders (Loading & Unloading Labour)</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
              Client requirements for Loaders are pending finalization. Below are the 4 recommended operational models ready to be configured as soon as confirmed.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="p-4 rounded-xl border border-border bg-secondary/30">
                <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">A</span>
                  Option A: Per Trip / Challan Fixed Loading
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Fixed loading charge recorded on each Delivery Challan during dispatch (e.g. ₹300 per pickup, ₹700 per truck). Automatically syncs with the transport ledger.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-secondary/30">
                <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">B</span>
                  Option B: Per Box / Per Unit Loading Rate
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Calculated based on actual box quantity dispatched (e.g. ₹2/box loaded). Integrates directly with Dispatched Quantity on delivery challan items.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-secondary/30">
                <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">C</span>
                  Option C: Daily Wage Pool (Helper Model)
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Loaders receive daily wages tracked through daily attendance (Present / Half Day / Absent), exactly like the Helper Labour Department above.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-secondary/30">
                <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">D</span>
                  Option D: Factory Expense Cash Voucher
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Directly logged as an operational factory expense under "Loading & Handling" without tracking an individual worker ledger.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
      */}

      {/* ====================================================================== */}
      {/* GLOBAL PAYROLL HISTORY SECTION */}
      {/* ====================================================================== */}
      <section className="mt-8">
        <div className="section-header flex items-center justify-between gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Unified Payroll History & Disbursement Records</h2>
          <ExportButton
            onClick={() => downloadCsv('unified-payroll-report', filteredPayroll.map(p => ({
              Worker: d.workers.find(w => w.id === p.labour_id)?.labour_name ?? '—',
              Category: d.workers.find(w => w.id === p.labour_id)?.labour_category ?? 'Contract',
              Date: p.payout_date ? dateLabel(p.payout_date) : (p.created_at ? dateLabel(p.created_at) : '—'),
              Gross: p.gross,
              Deductions: p.deductions,
              NetPaid: p.net_paid,
              Status: p.status ?? 'Pending'
            })))}
          />
        </div>

        {/* Date-wise Payroll Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <div className="p-4 bg-card border border-border rounded-xl">
            <span className="text-sm font-semibold text-muted-foreground block">Total Gross</span>
            <strong className="text-xl sm:text-2xl font-bold text-foreground mt-1 block">{money(totalPayrollGross)}</strong>
          </div>
          <div className="p-4 bg-card border border-border rounded-xl">
            <span className="text-sm font-semibold text-muted-foreground block">Total Deductions</span>
            <strong className="text-xl sm:text-2xl font-bold text-amber-500 mt-1 block">{money(totalPayrollDeductions)}</strong>
          </div>
          <div className="p-4 bg-card border border-border rounded-xl">
            <span className="text-sm font-semibold text-muted-foreground block">Net Disbursed</span>
            <strong className="text-xl sm:text-2xl font-bold text-emerald-500 mt-1 block">{money(totalPayrollNetPaid)}</strong>
          </div>
          <div className="p-4 bg-card border border-border rounded-xl">
            <span className="text-sm font-semibold text-muted-foreground block">Payout Records</span>
            <strong className="text-xl sm:text-2xl font-bold text-foreground mt-1 block">{number(filteredPayroll.length)} entries</strong>
          </div>
        </div>

        <div className="filters mb-4">
          <DateFilterPill label="From" value={payrollFrom} onChange={v => { setPayrollFrom(v); setHistoryPage(1); }} placeholder="All" />
          <DateFilterPill label="To" value={payrollTo} onChange={v => { setPayrollTo(v); setHistoryPage(1); }} placeholder="All" />
          <FilterToken
            label="Payment Status"
            value={payrollStatus}
            onChange={v => { setPayrollStatus(v); setHistoryPage(1); }}
            options={[
              { value: 'All', label: 'All statuses' },
              { value: 'Paid', label: 'Paid' },
              { value: 'Pending', label: 'Pending' }
            ]}
          />
          <FilterToken
            label="Worker"
            value={payrollWorkerId}
            onChange={v => { setPayrollWorkerId(v); setHistoryPage(1); }}
            options={[
              { value: 'All', label: 'All Workers' },
              ...d.workers.map(w => ({ value: w.id, label: w.labour_name }))
            ]}
          />
        </div>

        <div className="desktop-table-view table-wrap">
          <table>
            <thead>
              <tr>
                <th>Worker / Transporter / Helper</th>
                <th>Category</th>
                <th>Date</th>
                <th className="numeric">Gross</th>
                <th className="numeric">Deductions</th>
                <th className="numeric">Net Payable</th>
                <th className="numeric">Paid</th>
                <th className="numeric">Balance</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPayroll.length ? paginatedPayroll.map(p => {
                const paid = Number(p.amount_paid ?? 0);
                const balance = Math.max(0, p.net_paid - paid);
                const isPaid = (p.status ?? 'Pending') === 'Paid' || balance <= 0;
                const worker = d.workers.find(w => w.id === p.labour_id);

                return (
                  <tr key={p.id}>
                    <td className="font-medium text-foreground">{worker?.labour_name || 'Worker'}</td>
                    <td>
                      <span className="text-xs uppercase font-medium px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                        {worker?.labour_category || 'Contract'}
                      </span>
                    </td>
                    <td>{p.payout_date ? dateLabel(p.payout_date) : '—'}</td>
                    <td className="numeric">{money(p.gross)}</td>
                    <td className="numeric text-muted-foreground">{money(p.deductions)}</td>
                    <td className="numeric font-medium text-foreground">{money(p.net_paid)}</td>
                    <td className="numeric text-emerald-500">{money(paid)}</td>
                    <td className="numeric font-medium text-amber-500">{money(balance)}</td>
                    <td><Pill value={p.status ?? 'Pending'}/></td>
                    <td className="text-right">
                      {!isPaid && canRecordPayment && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2.5"
                          onClick={() => setPaymentModalPayroll(p)}
                        >
                          Record payment
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <Empty columns={10} label="No payroll records found." />
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={historyPage}
          totalItems={filteredPayroll.length}
          pageSize={pageSize}
          onPageChange={setHistoryPage}
        />
      </section>

      <VolumeCharts/>

      {/* ====================================================================== */}
      {/* MODAL 1: REGISTER / EDIT CONTRACT WORKER */}
      {/* ====================================================================== */}
      <Dialog open={contractModalOpen} onOpenChange={open => { if(!open){ setContractModalOpen(false); setEditingContractWorker(null); } }}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground tracking-tight pb-3 border-b border-border mb-4">
            {editingContractWorker ? 'Edit Contract Worker / Team' : 'Register Contract Worker / Team'}
          </DialogTitle>
          <form onSubmit={saveContractWorker}>
            <div className="form-grid">
              <label>
                Worker Name or Unit / Team Name
                <input
                  name="labour_name"
                  defaultValue={editingContractWorker?.labour_name || ''}
                  placeholder="e.g. Ramesh Team, Cutting Unit 1"
                  required
                />
              </label>
              <label>
                Working Type / Operation
                <ThemedSelect
                  name="working_type"
                  defaultValue={editingContractWorker?.working_type || 'Cutting'}
                  options={[
                    { value: 'Cutting', label: 'Cutting' },
                    { value: 'Fitting', label: 'Fitting' },
                    { value: 'Team', label: 'Team / Full Unit' },
                    { value: 'Assembly', label: 'Assembly' },
                    { value: 'General', label: 'General' },
                  ]}
                />
              </label>
              <label>
                Phone Number
                <input
                  type="tel"
                  name="phone"
                  defaultValue={editingContractWorker?.phone || ''}
                  placeholder="e.g. 9876543210"
                />
              </label>
              <label>
                Unit / Machine Assignment
                <input
                  name="unit_assignment"
                  defaultValue={editingContractWorker?.unit_assignment || ''}
                  placeholder="e.g. Machine A, Unit 1"
                />
              </label>
            </div>
            <div className="form-actions">
              <Button variant="outline" type="button" onClick={() => setContractModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={contractBusy}>
                {contractBusy ? 'Saving…' : editingContractWorker ? 'Update Worker' : 'Register Worker'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ====================================================================== */}
      {/* MODAL 2: REGISTER / EDIT TRANSPORTER */}
      {/* ====================================================================== */}
      <Dialog open={transportModalOpen} onOpenChange={open => { if(!open){ setTransportModalOpen(false); setEditingTransporter(null); } }}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground tracking-tight pb-3 border-b border-border mb-4">
            {editingTransporter ? 'Edit Transporter / Driver' : 'Register Transporter / Driver'}
          </DialogTitle>
          <form onSubmit={saveTransporter}>
            <div className="form-grid">
              <label>
                Driver / Transporter Name
                <input
                  name="labour_name"
                  defaultValue={editingTransporter?.labour_name || ''}
                  placeholder="e.g. Ramesh Bhai, Apex Cargo"
                  required
                />
              </label>
              <label>
                Vehicle Registration Number
                <input
                  name="vehicle_number"
                  defaultValue={editingTransporter?.vehicle_number || ''}
                  placeholder="e.g. GJ-01-AB-1234"
                  required
                />
              </label>
              <label>
                Vehicle Type / Name
                <input
                  name="vehicle_name"
                  defaultValue={editingTransporter?.vehicle_name || ''}
                  placeholder="e.g. Bolero Maxi Truck, Tata 407"
                />
              </label>
              <label>
                Default Trip Transport Charge (₹)
                <input
                  type="number"
                  min={0}
                  step=".01"
                  name="fixed_freight_charges"
                  defaultValue={editingTransporter?.fixed_freight_charges ?? ''}
                  placeholder="e.g. 750"
                />
              </label>
              <label>
                Phone Number
                <input
                  type="tel"
                  name="phone"
                  defaultValue={editingTransporter?.phone || ''}
                  placeholder="e.g. 9876543210"
                />
              </label>
              <label>
                Route / Unit Assignment
                <input
                  name="unit_assignment"
                  defaultValue={editingTransporter?.unit_assignment || ''}
                  placeholder="e.g. Ahmedabad Route, Factory Pickup"
                />
              </label>
            </div>
            <div className="form-actions">
              <Button variant="outline" type="button" onClick={() => setTransportModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={transportBusy}>
                {transportBusy ? 'Saving…' : editingTransporter ? 'Update Transporter' : 'Register Transporter'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ====================================================================== */}
      {/* MODAL 3: REGISTER / EDIT HELPER */}
      {/* ====================================================================== */}
      <Dialog open={helperModalOpen} onOpenChange={open => { if(!open){ setHelperModalOpen(false); setEditingHelper(null); } }}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground tracking-tight pb-3 border-b border-border mb-4">
            {editingHelper ? 'Edit Helper' : 'Register Helper (Daily Wage)'}
          </DialogTitle>
          <form onSubmit={saveHelper}>
            <div className="form-grid">
              <label>
                Helper Name
                <input
                  name="labour_name"
                  defaultValue={editingHelper?.labour_name || ''}
                  placeholder="e.g. Suresh Kumar"
                  required
                />
              </label>
              <label>
                Daily Wage Rate (₹)
                <input
                  type="number"
                  min={1}
                  step=".01"
                  name="daily_rate"
                  defaultValue={editingHelper?.daily_rate || ''}
                  placeholder="e.g. 450"
                  required
                />
              </label>
              <label>
                Phone Number
                <input
                  type="tel"
                  name="phone"
                  defaultValue={editingHelper?.phone || ''}
                  placeholder="e.g. 9876543210"
                />
              </label>
              <label>
                Unit / Area Assignment
                <input
                  name="unit_assignment"
                  defaultValue={editingHelper?.unit_assignment || ''}
                  placeholder="e.g. Yard, Packing, Timber Stacking"
                />
              </label>
            </div>
            <div className="form-actions">
              <Button variant="outline" type="button" onClick={() => setHelperModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={helperBusy}>
                {helperBusy ? 'Saving…' : editingHelper ? 'Update Helper' : 'Register Helper'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ====================================================================== */}
      {/* MODAL 4: RECORD BORROWING / ADVANCE */}
      {/* ====================================================================== */}
      <Dialog open={borrowModalOpen} onOpenChange={open => { setBorrowModalOpen(open); if(!open) clearModalSearchParams(); }}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground tracking-tight pb-3 border-b border-border mb-4">
            Record Worker Borrowing / Advance
          </DialogTitle>
          <form onSubmit={recordBorrowing}>
            <div className="form-grid">
              <label className="form-wide">
                Worker / Transporter / Helper
                <ThemedSelect
                  name="labour_id"
                  defaultValue={borrowLabourId || (d.workers[0]?.id ?? '')}
                  options={d.workers.map(w => ({
                    value: w.id,
                    label: `${w.labour_name} (${w.labour_category || 'Contract'} • ${w.unit_assignment || 'General'})`
                  }))}
                  required
                />
              </label>
              <label>
                Borrowing Date
                <ThemedDatePicker name="borrow_date" defaultValue={today()} required />
              </label>
              <label>
                Amount (₹)
                <input type="number" min={1} step=".01" name="amount" placeholder="e.g. 500" required />
              </label>
              <label className="form-wide">
                Remarks / Reason
                <input name="remarks" placeholder="e.g. Emergency advance, festival allowance" />
              </label>
            </div>
            <div className="form-actions">
              <Button variant="outline" type="button" onClick={() => setBorrowModalOpen(false)}>Cancel</Button>
              <Button disabled={busy} type="submit">{busy ? 'Recording…' : 'Record Advance'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ====================================================================== */}
      {/* MODAL 5: LOG FINISHED BOXES */}
      {/* ====================================================================== */}
      <Dialog open={!!selected} onOpenChange={open => { if(!open){ setSelected(null); clearModalSearchParams(); } }}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground tracking-tight pb-3 border-b border-border mb-4">
            Record Production Completion
          </DialogTitle>
          <form onSubmit={complete}>
            <div className="form-grid">
              <label className="form-wide">
                Total Completed Quantity
                <input
                  name="completed_qty"
                  type="number"
                  min={selected?.completed_qty ?? 0}
                  max={selected?.allocated_qty ?? 0}
                  defaultValue={selected?.allocated_qty ?? 0}
                  required
                />
              </label>
            </div>
            <div className="form-actions">
              <Button variant="outline" type="button" onClick={() => setSelected(null)}>Cancel</Button>
              <Button disabled={busy} type="submit">{busy ? 'Saving…' : 'Save Completion'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ====================================================================== */}
      {/* MODAL 6: INDIVIDUAL STATEMENT */}
      {/* ====================================================================== */}
      <Dialog open={!!statementWorker} onOpenChange={open => { if(!open){ setStatementWorker(null); clearModalSearchParams(); } }}>
        <DialogContent className="modal-wide max-w-2xl" aria-describedby={undefined}>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground tracking-tight pb-3 border-b border-border mb-4">
            Individual Labour Statement
          </DialogTitle>
          {statementWorker && (() => {
            const rawAllocs = d.allocations.filter(a => a.labour_id === statementWorker.id);
            const wAllocs = rawAllocs.filter(a => {
              const aDate = a.start_time ? a.start_time.slice(0, 10) : '';
              if (statementRange === 'All') return true;
              if (statementRange === 'Today') return aDate === todayStr;
              if (statementRange === 'Yesterday') return aDate === yesterdayStr;
              if (statementRange === 'Week') {
                const dt = new Date(a.start_time);
                return (now.getTime() - dt.getTime()) <= 7 * 86400000;
              }
              if (statementRange === 'Month') {
                const dt = new Date(a.start_time);
                return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
              }
              return true;
            });

            const wBorrowings = d.borrowings.filter(b => b.labour_id === statementWorker.id);
            const totalEarned = wAllocs.reduce((s, a) => s + (a.completed_qty * (a.labour_rate || 0)), 0);
            const totalPaid = wAllocs.reduce((s, a) => s + a.paid_earnings, 0);
            const totalBorrowed = wBorrowings.reduce((s, b) => s + b.amount, 0);
            const totalDeducted = wBorrowings.reduce((s, b) => s + b.deducted_amount, 0);
            const outstandingDebt = Math.max(0, totalBorrowed - totalDeducted);
            const unpaidEarnings = Math.max(0, totalEarned - totalPaid);
            const netPayable = Math.max(0, unpaidEarnings - (statementRange === 'All' ? outstandingDebt : 0));

            return (
              <div className="space-y-4">
                <div className="p-4 bg-secondary/50 rounded-xl border border-border flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-bold text-foreground text-lg sm:text-xl">{statementWorker.labour_name}</h3>
                    <p className="text-xs text-muted-foreground">{statementWorker.phone || 'No phone'} · {statementWorker.unit_assignment || 'General'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">{statementRange === 'All' ? 'Net Due (All Time)' : `Pay Due (${statementRange})`}</span>
                    <strong className="text-lg sm:text-xl font-bold text-foreground">{money(netPayable)}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-card border border-border rounded-lg">
                    <span className="text-muted-foreground block text-xs font-semibold">Gross Earned</span>
                    <strong className="text-foreground text-sm sm:text-base font-bold mt-0.5 block">{money(totalEarned)}</strong>
                  </div>
                  <div className="p-3 bg-card border border-border rounded-lg">
                    <span className="text-muted-foreground block text-xs font-semibold">Unpaid Gross</span>
                    <strong className="text-foreground text-sm sm:text-base font-bold mt-0.5 block">{money(unpaidEarnings)}</strong>
                  </div>
                  <div className="p-3 bg-card border border-border rounded-lg">
                    <span className="text-muted-foreground block text-xs font-semibold">Total Borrowed</span>
                    <strong className="text-foreground text-sm sm:text-base font-bold mt-0.5 block">{money(totalBorrowed)}</strong>
                  </div>
                  <div className="p-3 bg-card border border-border rounded-lg">
                    <span className="text-muted-foreground block text-xs font-semibold">Outstanding Debt</span>
                    <strong className="text-amber-500 text-sm sm:text-base font-bold mt-0.5 block">{money(outstandingDebt)}</strong>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Recent Allocations</h4>
                  <div className="max-h-40 overflow-y-auto border border-border rounded-lg text-xs">
                    {wAllocs.length ? (
                      <table className="w-full">
                        <thead className="bg-secondary/40 text-muted-foreground">
                          <tr>
                            <th className="p-2 text-left">Product Type</th>
                            <th className="p-2 text-right">Assigned</th>
                            <th className="p-2 text-right">Done</th>
                            <th className="p-2 text-right">Rate</th>
                            <th className="p-2 text-right">Earned</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wAllocs.map(a => (
                            <tr key={a.id} className="border-t border-border">
                              <td className="p-2">{d.items.find(i => i.id === a.order_item_id)?.box_type || '—'}</td>
                              <td className="p-2 text-right">{a.allocated_qty}</td>
                              <td className="p-2 text-right font-medium">{a.completed_qty}</td>
                              <td className="p-2 text-right">{money(a.labour_rate)}</td>
                              <td className="p-2 text-right font-medium">{money(a.completed_qty * a.labour_rate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-3 text-center text-muted-foreground">No allocations recorded.</div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button variant="outline" size="sm" onClick={() => setStatementWorker(null)}>Close Statement</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ====================================================================== */}
      {/* MODAL 7: RECORD DISBURSEMENT / PAYMENT */}
      {/* ====================================================================== */}
      <Dialog open={!!paymentModalPayroll} onOpenChange={open => { if(!open){ setPaymentModalPayroll(null); clearModalSearchParams(); } }}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground tracking-tight pb-3 border-b border-border mb-4">
            Record Payroll Payment
          </DialogTitle>
          {paymentModalPayroll && (() => {
            const paid = Number(paymentModalPayroll.amount_paid ?? 0);
            const balance = Math.max(0, paymentModalPayroll.net_paid - paid);
            const worker = d.workers.find(w => w.id === paymentModalPayroll.labour_id);
            return (
              <form onSubmit={recordPayment}>
                <div className="p-3 bg-card border border-border rounded-xl mb-4 grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-muted-foreground block text-xs font-semibold">Worker</span>
                    <strong className="text-foreground text-base sm:text-lg font-bold">{worker?.labour_name ?? '—'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs font-semibold">Net Payable</span>
                    <strong className="text-foreground text-base sm:text-lg font-bold">{money(paymentModalPayroll.net_paid)}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs font-semibold">Balance Due</span>
                    <strong className="text-amber-500 text-base sm:text-lg font-bold">{money(balance)}</strong>
                  </div>
                </div>
                <div className="form-grid">
                  <label>
                    Amount to Pay (₹)
                    <input
                      type="number"
                      min={0.01}
                      max={balance}
                      step=".01"
                      name="amount"
                      defaultValue={balance}
                      required
                    />
                  </label>
                  <label>
                    Payment Mode
                    <ThemedSelect
                      name="payment_mode"
                      defaultValue="Cash"
                      options={['Cash','UPI','Bank Transfer','Cheque','Other'].map(m => ({ value: m, label: m }))}
                    />
                  </label>
                  <label>
                    Disbursement Date
                    <ThemedDatePicker name="disbursed_at" defaultValue={today()} required />
                  </label>
                  <label>
                    Reference / Notes
                    <input name="reference_notes" placeholder="e.g. UPI Ref / Cash Voucher #" />
                  </label>
                </div>
                <div className="form-actions">
                  <Button variant="outline" type="button" onClick={() => setPaymentModalPayroll(null)}>Cancel</Button>
                  <Button disabled={busy} type="submit">{busy ? 'Recording…' : 'Confirm Payment'}</Button>
                </div>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
