import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobUrgency = 'normal' | 'urgent' | 'scheduled';
export type BookingStatus =
  | 'confirmed' |'craftsman_arrived' |'work_started' |'work_completed' |'cancelled';

export interface CreateJobPayload {
  craftsmanId: string;
  serviceId?: string;
  categoryId?: string;
  serviceType: string;
  description: string;
  address: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  urgency?: JobUrgency;
  scheduledAt?: string;
  amount?: number;
  paymentMethod?: 'card' | 'cash' | 'apple_pay' | 'wallet';
  notes?: string;
  serviceImages?: string[];
}

export interface MarketplaceJob {
  id: string;
  customerId: string;
  customerName: string;
  customerAvatar: string | null;
  serviceType: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  urgency: JobUrgency;
  amount: number | null;
  paymentMethod: string | null;
  scheduledAt: string | null;
  serviceImages: string[];
  status: string;
  createdAt: string;
  categoryName: string | null;
  categoryEmoji: string | null;
}

export interface MarketplaceBooking {
  id: string;
  orderId: string;
  bookingStatus: BookingStatus;
  scheduledDate: string | null;
  scheduledTimeSlot: string | null;
  serviceAddress: string | null;
  serviceCity: string | null;
  serviceLatitude: number | null;
  serviceLongitude: number | null;
  serviceType: string | null;
  serviceDescription: string | null;
  agreedAmount: number | null;
  confirmedAt: string;
  craftsmanArrivedAt: string | null;
  workStartedAt: string | null;
  workCompletedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  customerId: string;
  customerName: string;
  customerAvatar: string | null;
  customerPhone: string | null;
  craftsmanId: string;
  craftsmanName: string;
  craftsmanAvatar: string | null;
  craftsmanRating: number;
  craftsmanSpecialty: string | null;
  craftsmanPhone: string | null;
}

// ─── Jobs (Orders) ────────────────────────────────────────────────────────────

/**
 * Create a new job request (customer posts a job)
 */
export async function createJob(payload: CreateJobPayload): Promise<{ id: string } | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('orders')
    .insert({
      craftsman_id: payload.craftsmanId,
      service_id: payload.serviceId ?? null,
      category_id: payload.categoryId ?? null,
      service_type: payload.serviceType,
      description: payload.description,
      address: payload.address,
      city: payload.city ?? null,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      urgency: payload.urgency ?? 'normal',
      scheduled_at: payload.scheduledAt ?? null,
      amount: payload.amount ?? null,
      payment_method: payload.paymentMethod ?? 'cash',
      notes: payload.notes ?? null,
      service_images: payload.serviceImages ?? [],
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    console.error('createJob error:', error.message);
    return null;
  }

  return { id: data.id };
}

/**
 * Fetch open marketplace jobs (pending orders) visible to craftsmen
 */
export async function fetchMarketplaceJobs(filters?: {
  city?: string;
  serviceType?: string;
  categoryId?: string;
  limit?: number;
}): Promise<MarketplaceJob[]> {
  const supabase = createClient();

  let query = supabase
    .from('marketplace_jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.city) {
    query = query.ilike('city', `%${filters.city}%`);
  }
  if (filters?.serviceType) {
    query = query.ilike('service_type', `%${filters.serviceType}%`);
  }
  if (filters?.categoryId) {
    query = query.eq('category_id', filters.categoryId);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('fetchMarketplaceJobs error:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerAvatar: row.customer_avatar,
    serviceType: row.service_type,
    description: row.description,
    address: row.address,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    urgency: row.urgency ?? 'normal',
    amount: row.amount,
    paymentMethod: row.payment_method,
    scheduledAt: row.scheduled_at,
    serviceImages: row.service_images ?? [],
    status: row.status,
    createdAt: row.created_at,
    categoryName: row.category_name,
    categoryEmoji: row.category_emoji,
  }));
}

/**
 * Fetch jobs for a specific customer
 */
export async function fetchCustomerJobs(customerId: string): Promise<MarketplaceJob[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, customer_id, service_type, description, address, city,
      latitude, longitude, urgency, amount, payment_method,
      scheduled_at, service_images, status, created_at, category_id,
      service_categories(name, emoji)
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchCustomerJobs error:', error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: '',
    customerAvatar: null,
    serviceType: row.service_type,
    description: row.description,
    address: row.address,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    urgency: row.urgency ?? 'normal',
    amount: row.amount,
    paymentMethod: row.payment_method,
    scheduledAt: row.scheduled_at,
    serviceImages: row.service_images ?? [],
    status: row.status,
    createdAt: row.created_at,
    categoryName: row.service_categories?.name ?? null,
    categoryEmoji: row.service_categories?.emoji ?? null,
  }));
}

/**
 * Accept a job (craftsman accepts a pending order → triggers booking creation)
 */
export async function acceptJob(orderId: string): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('orders')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'pending');

  if (error) {
    console.error('acceptJob error:', error.message);
    return false;
  }

  return true;
}

/**
 * Update order/job status
 */
export async function updateJobStatus(
  orderId: string,
  status: 'accepted' | 'in_progress' | 'completed' | 'cancelled'
): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) {
    console.error('updateJobStatus error:', error.message);
    return false;
  }

  return true;
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

/**
 * Fetch bookings for the current user (customer or craftsman)
 */
export async function fetchMyBookings(): Promise<MarketplaceBooking[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('marketplace_bookings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchMyBookings error:', error.message);
    return [];
  }

  return (data ?? []).map(mapBookingRow);
}

/**
 * Fetch a single booking by ID
 */
export async function fetchBookingById(bookingId: string): Promise<MarketplaceBooking | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('marketplace_bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (error) {
    console.error('fetchBookingById error:', error.message);
    return null;
  }

  return mapBookingRow(data);
}

/**
 * Update booking status (craftsman marks arrival, work start, etc.)
 */
export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  cancellationReason?: string
): Promise<boolean> {
  const supabase = createClient();

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    booking_status: status,
    updated_at: now,
  };

  if (status === 'craftsman_arrived') updates.craftsman_arrived_at = now;
  if (status === 'work_started') updates.work_started_at = now;
  if (status === 'work_completed') updates.work_completed_at = now;
  if (status === 'cancelled') {
    updates.cancelled_at = now;
    if (cancellationReason) updates.cancellation_reason = cancellationReason;
  }

  const { error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', bookingId);

  if (error) {
    console.error('updateBookingStatus error:', error.message);
    return false;
  }

  return true;
}

/**
 * Fetch bookings for a craftsman by their craftsman_profile id
 */
export async function fetchCraftsmanBookings(craftsmanProfileId: string): Promise<MarketplaceBooking[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('marketplace_bookings')
    .select('*')
    .eq('craftsman_id', craftsmanProfileId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchCraftsmanBookings error:', error.message);
    return [];
  }

  return (data ?? []).map(mapBookingRow);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapBookingRow(row: any): MarketplaceBooking {
  return {
    id: row.id,
    orderId: row.order_id,
    bookingStatus: row.booking_status,
    scheduledDate: row.scheduled_date,
    scheduledTimeSlot: row.scheduled_time_slot,
    serviceAddress: row.service_address,
    serviceCity: row.service_city,
    serviceLatitude: row.service_latitude,
    serviceLongitude: row.service_longitude,
    serviceType: row.service_type,
    serviceDescription: row.service_description,
    agreedAmount: row.agreed_amount,
    confirmedAt: row.confirmed_at,
    craftsmanArrivedAt: row.craftsman_arrived_at,
    workStartedAt: row.work_started_at,
    workCompletedAt: row.work_completed_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerAvatar: row.customer_avatar,
    customerPhone: row.customer_phone,
    craftsmanId: row.craftsman_id,
    craftsmanName: row.craftsman_name,
    craftsmanAvatar: row.craftsman_avatar,
    craftsmanRating: row.craftsman_rating ?? 0,
    craftsmanSpecialty: row.craftsman_specialty,
    craftsmanPhone: row.craftsman_phone,
  };
}
