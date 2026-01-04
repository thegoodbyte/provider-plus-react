export interface Retreat {
  _id?: string;
  name: string;
  location: string;
  startDate?: Date | string;
  endDate?: Date | string;
  capacity?: number;
  currentOccupancy?: number;
  description?: string;
  houseId?: string;
  status?: 'active' | 'completed' | 'cancelled' | 'upcoming';
  type?: 'regular' | 'booster';
  createdAt?: string;
  updatedAt?: string;
  // Legacy format support
  dates?: {
    startDate?: string;
    startTime?: string;
    endTime?: string;
  };
}

export interface House {
  _id?: string;
  name?: string;
  address?: string;
  capacity?: number;
  numberOfRooms?: number;
  numberOfBathrooms?: number;
  amenities?: string[];
  description?: string;
  status?: 'available' | 'occupied' | 'maintenance';
  pricePerNight?: number;
  createdAt?: string;
  updatedAt?: string;
  // Legacy format support
  city?: string;
  bedrooms?: number;
  guestCapacity?: number;
}

export interface Client {
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  dateOfBirth?: Date | string;
  emergencyContact?: string;
  emergencyContactPhone?: string;
  medicalConditions?: string;
  dietaryRestrictions?: string;
  status?: 'active' | 'inactive' | 'suspended';
  notes?: string;
  preferredName?: string;
  occupation?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  height?: string;
  weight?: number;
  createdAt?: string;
  updatedAt?: string;
  // Legacy support
  fname?: string;
  lname?: string;
}

export interface RetreatClient {
  _id?: string;
  retreatId: string;
  clientId: string;
  registrationDate: Date | string;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  totalAmount: number;
  amountPaid?: number;
  status?: 'pending' | 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled';
  roomAssignment?: string;
  specialRequests?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientMedical {
  _id?: string;
  clientId: string;
  retreatId: string;

  // Liver Panel
  liverPanelReceivedDate?: Date | string;
  liverPanelResults?: string;
  liverPanelFilePath?: string;
  liverPanelFileName?: string;
  liverPanelFileSize?: number;
  liverPanelSentToAdvisorDate?: Date | string;
  liverPanelAdvisorNotes?: string;
  liverPanelStatus?: 'pending' | 'received' | 'reviewed' | 'approved' | 'rejected';

  // EKG
  ekgReceivedDate?: Date | string;
  ekgResults?: string;
  ekgFilePath?: string;
  ekgFileName?: string;
  ekgFileSize?: number;
  ekgSentToAdvisorDate?: Date | string;
  ekgAdvisorNotes?: string;
  ekgStatus?: 'pending' | 'received' | 'reviewed' | 'approved' | 'rejected';

  // Medical Advisor
  medicalAdvisorName?: string;
  medicalAdvisorEmail?: string;
  finalMedicalClearance?: boolean;
  medicalClearanceDate?: Date | string;
  medicalClearanceNotes?: string;
  generalNotes?: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface Requirement {
  _id?: string;
  name: string;
  description: string;
  weeksBeforeRetreat: number;
  gracePeriodWeeks?: number;
  category: 'questionnaire' | 'medical' | 'dietary' | 'document' | 'payment' | 'other';
  isActive?: boolean;
  requiresFile?: boolean;
  requiresAmount?: boolean;
  requiresApproval?: boolean;
  instructions?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  order?: number;
  dependsOn?: string[]; // Array of requirement IDs that must be completed first
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientRequirement {
  _id?: string;
  clientId: string;
  retreatId: string;
  requirementId: string;
  status?: 'pending' | 'sent' | 'received' | 'reviewed' | 'approved' | 'rejected' | 'overdue' | 'waived';
  sentDate?: Date | string;
  dueDate?: Date | string;
  receivedDate?: Date | string;
  reviewedDate?: Date | string;
  approvedDate?: Date | string;

  // File information
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;

  // Payment/Amount information
  amount?: number;
  currency?: 'CZK' | 'EUR' | 'PLN';
  paymentMethod?: string;

  // Approval information
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'needs_review';
  approvedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;

  // Links and external references
  linkUrl?: string;
  externalReference?: string;

  notes?: string;
  reviewerNotes?: string;
  clientNotes?: string;
  isOverdue?: boolean;
  daysPastDue?: number;

  // Medical specific fields
  medicalReviewed?: boolean;
  medicalApproved?: boolean;
  medicalNotes?: string;

  createdAt?: string;
  updatedAt?: string;

  // Populated fields
  requirement?: Requirement;
}

export interface Reminder {
  _id?: string;
  clientId: string;
  retreatId: string;
  requirementId?: string;
  title: string;
  description: string;
  dueDate: Date | string;
  status?: 'pending' | 'sent' | 'completed' | 'dismissed' | 'overdue';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  actionType: 'ask_for_document' | 'review_document' | 'follow_up' | 'medical_clearance' | 'general' | 'payment';
  assignedTo?: string;
  completedDate?: Date | string;
  notes?: string;
  isRecurring?: boolean;
  recurringDays?: number;
  parentReminderId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpenseType {
  _id?: string;
  name: string;
  description?: string;
  category: 'accommodation' | 'transport' | 'food' | 'activities' | 'staff' | 'utilities' | 'general';
  defaultCurrency?: string;
  defaultAmount?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RetreatExpense {
  _id?: string;
  retreatId: string;
  expenseTypeId: string | ExpenseType;
  amount: number;
  currency: 'CZK' | 'EUR' | 'PLN';
  description?: string;
  vendor?: string;
  expenseDate: Date | string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  isAutoGenerated?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpenseSummary {
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  expensesByStatus: Record<string, number>;
  expensesByCurrency: Record<string, number>;
  count: number;
}

export interface Payment {
  _id?: string;
  clientId: string | Client;
  retreatId: string | Retreat;
  bookingId?: string | RetreatClient;
  amount: number;
  currency: 'CZK' | 'EUR' | 'PLN';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: 'bank_transfer' | 'card' | 'cash' | 'paypal' | 'crypto' | 'other';
  description?: string;
  transactionId?: string;
  paymentDate: Date | string;
  processedDate?: Date | string;
  refundedAmount?: number;
  refundedDate?: Date | string;
  notes?: string;
  isDeposit: boolean;
  isFinalPayment: boolean;
  exchangeRate?: number;
  amountInEUR?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentSummary {
  totalPayments: number;
  totalPaymentsEUR: number;
  completedPayments: number;
  completedPaymentsEUR: number;
  pendingPayments: number;
  pendingPaymentsEUR: number;
  refundedPayments: number;
  refundedPaymentsEUR: number;
  paymentsByMethod: Record<string, number>;
  paymentsByStatus: Record<string, number>;
  depositsPaid: number;
  depositsEUR: number;
  finalPaymentsPaid: number;
  finalPaymentsEUR: number;
}

export interface ScreeningClient {
  _id?: string;

  // Basic Information
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  email?: string;
  firstContactDate: Date | string;

  // Screening Status
  status?: 'initial' | 'in_progress' | 'completed' | 'approved' | 'rejected' | 'converted';
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  // Motivation & Goals
  whySeekingIboga: string;
  whatToChange: string;
  previousPlantMedicines?: string;
  spiritualBackground?: string;

  // Personal History
  childhood?: string;
  traumaHistory?: string;
  mentalHealthHistory?: string;
  addictionHistory?: string;

  // Health Information
  heartConditions?: string;
  liverConditions?: string;
  asthmaConditions?: string;
  otherMedicalComplications?: string;
  bloodPressureIssues?: string;
  seizureHistory?: string;
  psychoticEpisodes?: string;

  // Current Medications & Substances
  currentMedications?: string;
  recreationalDrugs?: string;
  vitaminsSupplements?: string;
  alcoholConsumption?: string;

  // Safety Considerations
  suicidalThoughts?: string;
  hospitalizations?: string;
  allergies?: string;
  weightRange?: string;
  pregnancyStatus?: string;

  // Administrative
  notes?: string;
  followUpDate?: Date | string;
  screeningCompletedDate?: Date | string;
  rejectionReason?: string;
  convertedToClientId?: string;
  convertedDate?: Date | string;

  createdAt?: string;
  updatedAt?: string;
}