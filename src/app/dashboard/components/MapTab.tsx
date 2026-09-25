'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

// Dynamic import to avoid SSR issues with leaflet
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-2xl">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">جاري تحميل الخريطة...</p>
      </div>
    </div>
  ),
});

export interface CraftsmanMapData {
  id: string;
  user_id: string;
  full_name: string;
  specialty: string | null;
  location: string | null;
  is_online: boolean;
  is_verified: boolean;
  rating: number;
  completed_jobs: number;
  lat: number | null;
  lng: number | null;
}

export interface OrderData {
  id: string;
  description: string | null;
  address: string | null;
  status: string;
  amount: number | null;
  created_at: string;
  customer_name: string;
  craftsman_id: string;
  craftsman_name: string;
  craftsman_profile_id: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'معلق',
  accepted: 'مقبول',
  in_progress: 'جاري',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
  accepted: 'bg-blue-900/50 text-blue-300 border-blue-800/50',
  in_progress: 'bg-violet-900/50 text-violet-300 border-violet-800/50',
  completed: 'bg-emerald-900/50 text-emerald-300 border-emerald-800/50',
  cancelled: 'bg-red-900/50 text-red-300 border-red-800/50',
};

// Parse location string like "24.7136,46.6753" or "Riyadh" into lat/lng
function parseLocation(location: string | null): { lat: number; lng: number } | null {
  if (!location) return null;
  const parts = location.split(',');
  if (parts.length === 2) {
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  return null;
}

// Fallback: generate a random position near Riyadh for craftsmen without coordinates
function generateFallbackPosition(seed: string): { lat: number; lng: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const lat = 24.6 + (Math.abs(hash % 1000) / 1000) * 0.4;
  const lng = 46.5 + (Math.abs((hash >> 8) % 1000) / 1000) * 0.4;
  return { lat, lng };
}

export default function MapTab() {
  const supabase = createClient();
  const [craftsmen, setCraftsmen] = useState<CraftsmanMapData[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCraftsman, setSelectedCraftsman] = useState<CraftsmanMapData | null>(null);

  // Assignment modal state
  const [assignModal, setAssignModal] = useState(false);
  const [assignOrderId, setAssignOrderId] = useState('');
  const [assignCraftsmanId, setAssignCraftsmanId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Transfer modal state
  const [transferModal, setTransferModal] = useState(false);
  const [transferOrder, setTransferOrder] = useState<OrderData | null>(null);
  const [transferToCraftsmanId, setTransferToCraftsmanId] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');

  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [craftsmenRes, ordersRes] = await Promise.all([
        supabase
          .from('craftsman_profiles')
          .select('id, user_id, specialty, location, is_online, is_verified, rating, completed_jobs, user_profiles(full_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select(`
            id, description, address, status, amount, created_at, craftsman_id,
            customer:customer_id(full_name),
            craftsman_profiles(id, user_id, user_profiles(full_name))
          `)
          .not('status', 'in', '("completed","cancelled")')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (craftsmenRes.data) {
        const mapped: CraftsmanMapData[] = craftsmenRes.data.map((c: any) => {
          const parsed = parseLocation(c.location);
          const fallback = generateFallbackPosition(c.id);
          return {
            id: c.id,
            user_id: c.user_id,
            full_name: c.user_profiles?.full_name || 'حرفي',
            specialty: c.specialty,
            location: c.location,
            is_online: c.is_online,
            is_verified: c.is_verified,
            rating: c.rating || 0,
            completed_jobs: c.completed_jobs || 0,
            lat: parsed?.lat ?? fallback.lat,
            lng: parsed?.lng ?? fallback.lng,
          };
        });
        setCraftsmen(mapped);
      }

      if (ordersRes.data) {
        const mapped: OrderData[] = ordersRes.data.map((o: any) => ({
          id: o.id,
          description: o.description,
          address: o.address,
          status: o.status,
          amount: o.amount,
          created_at: o.created_at,
          customer_name: o.customer?.full_name || 'عميل',
          craftsman_id: o.craftsman_profiles?.user_id || '',
          craftsman_name: o.craftsman_profiles?.user_profiles?.full_name || '—',
          craftsman_profile_id: o.craftsman_id || '',
        }));
        setOrders(mapped);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Assign order to craftsman
  const handleAssign = async () => {
    if (!assignOrderId || !assignCraftsmanId) {
      setAssignError('يرجى اختيار الطلب والحرفي');
      return;
    }
    setAssignLoading(true);
    setAssignError('');
    try {
      const { error } = await supabase
        .from('orders')
        .update({ craftsman_id: assignCraftsmanId, status: 'accepted' })
        .eq('id', assignOrderId);
      if (error) throw error;
      setAssignModal(false);
      setAssignOrderId('');
      setAssignCraftsmanId('');
      showSuccess('تم تعيين الطلب بنجاح');
      await loadData();
    } catch (e: any) {
      setAssignError(e.message || 'حدث خطأ');
    } finally {
      setAssignLoading(false);
    }
  };

  // Transfer order from one craftsman to another
  const handleTransfer = async () => {
    if (!transferOrder || !transferToCraftsmanId) {
      setTransferError('يرجى اختيار الحرفي الجديد');
      return;
    }
    if (transferToCraftsmanId === transferOrder.craftsman_profile_id) {
      setTransferError('الحرفي المختار هو نفس الحرفي الحالي');
      return;
    }
    setTransferLoading(true);
    setTransferError('');
    try {
      const { error } = await supabase
        .from('orders')
        .update({ craftsman_id: transferToCraftsmanId, status: 'accepted' })
        .eq('id', transferOrder.id);
      if (error) throw error;
      setTransferModal(false);
      setTransferOrder(null);
      setTransferToCraftsmanId('');
      showSuccess('تم نقل الطلب بنجاح');
      await loadData();
    } catch (e: any) {
      setTransferError(e.message || 'حدث خطأ');
    } finally {
      setTransferLoading(false);
    }
  };

  const openTransfer = (order: OrderData) => {
    setTransferOrder(order);
    setTransferToCraftsmanId('');
    setTransferError('');
    setTransferModal(true);
  };

  const openAssign = (craftsmanId?: string) => {
    setAssignCraftsmanId(craftsmanId || '');
    setAssignOrderId('');
    setAssignError('');
    setAssignModal(true);
  };

  // Unassigned orders (pending with no craftsman or craftsman_id is null)
  const unassignedOrders = orders.filter((o) => !o.craftsman_profile_id || o.status === 'pending');
  const activeOrders = orders.filter((o) => o.craftsman_profile_id && o.status !== 'pending');

  return (
    <div className="space-y-4" dir="rtl">
      {/* Success toast */}
      {successMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2">
          <Icon name="CheckCircleIcon" size={18} />
          {successMsg}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-gray-400">{craftsmen.filter(c => c.is_online).length} حرفي متصل</span>
          <div className="w-2 h-2 rounded-full bg-gray-600 mr-2" />
          <span className="text-xs text-gray-400">{craftsmen.length} إجمالي الحرفيين</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openAssign()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Icon name="PlusCircleIcon" size={16} />
            تعيين طلب يدوي
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-xs text-gray-300 transition-colors"
          >
            <Icon name="ArrowPathIcon" size={14} />
            تحديث
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden" style={{ height: '420px' }}>
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">جاري تحميل البيانات...</p>
            </div>
          </div>
        ) : (
          <MapComponent
            craftsmen={craftsmen}
            onCraftsmanSelect={setSelectedCraftsman}
            onAssignOrder={(craftsmanId) => openAssign(craftsmanId)}
          />
        )}
      </div>

      {/* Selected craftsman info */}
      {selectedCraftsman && (
        <div className="bg-gray-900 border border-emerald-800/50 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-amber-900/50 flex items-center justify-center flex-shrink-0">
              <Icon name="WrenchScrewdriverIcon" size={18} className="text-amber-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{selectedCraftsman.full_name}</p>
              <p className="text-gray-400 text-xs">{selectedCraftsman.specialty || 'حرفي عام'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border ${selectedCraftsman.is_online ? 'bg-emerald-900/50 text-emerald-300 border-emerald-800/50' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${selectedCraftsman.is_online ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                  {selectedCraftsman.is_online ? 'متصل' : 'غير متصل'}
                </span>
                <span className="flex items-center gap-1 text-xs text-yellow-300">
                  <Icon name="StarIcon" size={12} className="text-yellow-400" />
                  {selectedCraftsman.rating.toFixed(1)}
                </span>
                <span className="text-xs text-gray-500">{selectedCraftsman.completed_jobs} وظيفة</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => openAssign(selectedCraftsman.id)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-colors flex-shrink-0"
          >
            <Icon name="ClipboardDocumentCheckIcon" size={16} />
            تعيين طلب لهذا الحرفي
          </button>
        </div>
      )}

      {/* Orders section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active orders with transfer option */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">الطلبات النشطة</h3>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-lg">{activeOrders.length}</span>
          </div>
          <div className="divide-y divide-gray-800 max-h-64 overflow-y-auto">
            {activeOrders.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-8">لا توجد طلبات نشطة</p>
            ) : (
              activeOrders.map((order) => (
                <div key={order.id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-800/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-lg border text-xs font-semibold ${STATUS_COLORS[order.status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                      {order.amount && (
                        <span className="text-emerald-300 text-xs font-semibold">{order.amount} ر.س</span>
                      )}
                    </div>
                    <p className="text-white text-xs font-medium truncate">{order.description || 'طلب خدمة'}</p>
                    <p className="text-gray-500 text-xs mt-0.5">العميل: {order.customer_name} • الحرفي: {order.craftsman_name}</p>
                  </div>
                  <button
                    onClick={() => openTransfer(order)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-900/50 hover:bg-violet-800/60 border border-violet-800/50 text-violet-300 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                  >
                    <Icon name="ArrowsRightLeftIcon" size={12} />
                    نقل
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Unassigned / pending orders */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">الطلبات غير المعينة</h3>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-lg">{unassignedOrders.length}</span>
          </div>
          <div className="divide-y divide-gray-800 max-h-64 overflow-y-auto">
            {unassignedOrders.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-8">لا توجد طلبات معلقة</p>
            ) : (
              unassignedOrders.map((order) => (
                <div key={order.id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-800/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-lg border text-xs font-semibold bg-yellow-900/50 text-yellow-300 border-yellow-800/50">
                        معلق
                      </span>
                      {order.amount && (
                        <span className="text-emerald-300 text-xs font-semibold">{order.amount} ر.س</span>
                      )}
                    </div>
                    <p className="text-white text-xs font-medium truncate">{order.description || 'طلب خدمة'}</p>
                    <p className="text-gray-500 text-xs mt-0.5">العميل: {order.customer_name}</p>
                  </div>
                  <button
                    onClick={() => { setAssignOrderId(order.id); setAssignCraftsmanId(''); setAssignError(''); setAssignModal(true); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-900/50 hover:bg-emerald-800/60 border border-emerald-800/50 text-emerald-300 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                  >
                    <Icon name="UserPlusIcon" size={12} />
                    تعيين
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Assign Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-base font-bold text-white">تعيين طلب يدوي</h3>
              <button onClick={() => setAssignModal(false)} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors">
                <Icon name="XMarkIcon" size={16} className="text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">اختر الطلب</label>
                <select
                  value={assignOrderId}
                  onChange={(e) => setAssignOrderId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-600"
                  dir="rtl"
                >
                  <option value="">-- اختر طلباً --</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.description || 'طلب خدمة'} — {o.customer_name} ({STATUS_LABELS[o.status] || o.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">اختر الحرفي</label>
                <select
                  value={assignCraftsmanId}
                  onChange={(e) => setAssignCraftsmanId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-600"
                  dir="rtl"
                >
                  <option value="">-- اختر حرفياً --</option>
                  {craftsmen.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} {c.specialty ? `— ${c.specialty}` : ''} {c.is_online ? '🟢' : '⚫'}
                    </option>
                  ))}
                </select>
              </div>
              {assignError && (
                <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{assignError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleAssign}
                  disabled={assignLoading}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {assignLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon name="CheckIcon" size={16} />
                  )}
                  تعيين الطلب
                </button>
                <button
                  onClick={() => setAssignModal(false)}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-semibold transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {transferModal && transferOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-base font-bold text-white">نقل الطلب إلى حرفي آخر</h3>
              <button onClick={() => setTransferModal(false)} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors">
                <Icon name="XMarkIcon" size={16} className="text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Current order info */}
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">الطلب الحالي</p>
                <p className="text-white text-sm font-medium">{transferOrder.description || 'طلب خدمة'}</p>
                <p className="text-gray-400 text-xs mt-1">الحرفي الحالي: <span className="text-amber-300">{transferOrder.craftsman_name}</span></p>
                <p className="text-gray-400 text-xs">العميل: {transferOrder.customer_name}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">اختر الحرفي الجديد</label>
                <select
                  value={transferToCraftsmanId}
                  onChange={(e) => setTransferToCraftsmanId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-600"
                  dir="rtl"
                >
                  <option value="">-- اختر حرفياً --</option>
                  {craftsmen
                    .filter((c) => c.id !== transferOrder.craftsman_profile_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} {c.specialty ? `— ${c.specialty}` : ''} {c.is_online ? '🟢' : '⚫'}
                      </option>
                    ))}
                </select>
              </div>
              {transferError && (
                <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{transferError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleTransfer}
                  disabled={transferLoading}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {transferLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon name="ArrowsRightLeftIcon" size={16} />
                  )}
                  نقل الطلب
                </button>
                <button
                  onClick={() => setTransferModal(false)}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-semibold transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
