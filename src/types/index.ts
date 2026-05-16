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
  helpers?: string;
  status?: 'active' | 'completed' | 'cancelled' | 'upcoming';
  type?: 'regular' | 'booster';
  backgroundColor?: string; // Added for custom background color
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
  allInclusive?: boolean;
  payingForElectricity?: boolean;
  bookingSource?: 'Airbnb' | 'Owner';
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
  phoneCountryCode?: string;
  loginPin?: string;
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
  workflowStatus?: 'potential' | 'screening' | 'approved' | 'rejected' | 'booked' | 'cancelled' | 'completed' | 'blacklisted';
  blacklistReason?: string;
  blacklistDate?: Date | string;
  display_id?: number;
  language?: 'EN' | 'PL' | 'CZ' | 'ES' | 'FR' | 'DE';
  initialContactDate?: Date | string;
  conversionDate?: Date | string;
  firstContactDate?: Date | string;
  rejectionReason?: string;
  source?: string;
  tags?: string[];
  notes?: string;
  preferredName?: string;
  occupation?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  height?: string;
  weight?: number;
  depositFormHash?: string;
  accessCode?: string;
  // Screening fields
  whySeekingIboga?: string;
  whatToChange?: string;
  previousPlantMedicines?: string;
  spiritualBackground?: string;
  childhood?: string;
  traumaHistory?: string;
  mentalHealthHistory?: string;
  addictionHistory?: string;
  heartConditions?: string;
  liverConditions?: string;
  asthmaConditions?: string;
  otherMedicalComplications?: string;
  bloodPressureIssues?: string;
  seizureHistory?: string;
  psychoticEpisodes?: string;
  currentMedications?: string;
  recreationalDrugs?: string;
  vitaminsSupplements?: string;
  alcoholConsumption?: string;
  suicidalThoughts?: string;
  hospitalizations?: string;
  allergies?: string;
  weightRange?: string;
  pregnancyStatus?: string;
  screeningCompletedDate?: Date | string;
  followUpDate?: Date | string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  signupDate?: Date | string;
  createdAt?: string;
  updatedAt?: string;
  // Legacy support
  fname?: string;
  lname?: string;
}

export interface RetreatClient {
  _id?: string;
  bookingNumber?: string;
  bookingHash?: string; // 20-character alphanumeric hash for linking payments
  retreatId: string;
  clientId: string;
  bookingType?: 'full_retreat' | 'booster'; // Type of booking
  registrationDate: Date | string;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  totalAmount: number;
  currency?: 'EUR' | 'USD' | 'CZK' | 'PLN';
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
  liverPanelS3Key?: string;
  liverPanelSentToAdvisorDate?: Date | string;
  liverPanelAdvisorNotes?: string;
  liverPanelStatus?: 'pending' | 'received' | 'reviewed' | 'approved' | 'rejected';

  // EKG
  ekgReceivedDate?: Date | string;
  ekgResults?: string;
  ekgFilePath?: string;
  ekgFileName?: string;
  ekgFileSize?: number;
  ekgS3Key?: string;
  ekgSentToAdvisorDate?: Date | string;
  ekgAdvisorNotes?: string;
  ekgStatus?: 'pending' | 'received' | 'reviewed' | 'approved' | 'rejected';

  // Questionnaire
  questionnaireReceivedDate?: Date | string;
  questionnaireStatus?: 'pending' | 'received' | 'reviewed' | 'approved' | 'rejected';
  questionnaireNotes?: string;

  // Medications Form
  medicationsFormReceivedDate?: Date | string;
  medicationsFormFilePath?: string;
  medicationsFormFileName?: string;
  medicationsFormStatus?: 'pending' | 'received' | 'reviewed' | 'approved' | 'rejected';
  medicationsFormNotes?: string;

  // Food Intake
  foodIntakeReceivedDate?: Date | string;
  foodIntakeFilePath?: string;
  foodIntakeFileName?: string;
  foodIntakeStatus?: 'pending' | 'received' | 'sent_to_cook';
  foodIntakeSentToCookDate?: Date | string;
  foodIntakeNotes?: string;

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
  currency: 'EUR' | 'USD' | 'CZK' | 'PLN';
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
  bookingId?: string | RetreatClient; // Legacy - for backward compatibility
  bookingHash?: string; // New field - 20-character hash for linking to specific booking
  amount: number;
  currency: 'EUR' | 'USD' | 'CZK' | 'PLN';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: 'bank_transfer' | 'card' | 'cash' | 'paypal' | 'crypto' | 'stripe' | 'wise' | 'revolut' | 'other';
  paymentType: 'deposit_non_refundable' | 'deposit_refundable' | 'regular_payment' | 'balance_payment' | 'refund' | 'adjustment';
  description?: string;
  transactionId?: string;
  transactionReference?: string;
  paymentDate: Date | string;
  processedDate?: Date | string;
  refundedAmount?: number;
  refundedDate?: Date | string;
  notes?: string;
  isDeposit: boolean;
  isFinalPayment: boolean;
  isRefundable: boolean;
  exchangeRate?: number;
  amountInEUR?: number;
  processedBy?: string;
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
  screeningId?: string; // ISCZ-P-XXXX format ID

  // Basic Information
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  email?: string;
  age?: number;
  firstContactDate: Date | string;

  // Screening Status
  status?: 'initial' | 'in_progress' | 'completed' | 'approved' | 'rejected' | 'converted';
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  // Motivation & Goals
  whySeekingIboga: string;
  whatToChange: string;
  previousPlantMedicines?: {
    ayahuasca?: boolean;
    marijuana?: boolean;
    psilocybin?: boolean;
    other?: boolean;
    otherDetails?: string;
  };
  spiritualBackground?: string;

  // Personal History
  childhood?: string;
  traumaHistory?: string;
  mentalHealthHistory?: string;
  addictionHistory?: string;

  // Health Information
  heartConditions?: {
    ok?: boolean;
    na?: boolean;
    details?: string;
  } | string; // Keep string for backward compatibility
  liverConditions?: {
    ok?: boolean;
    na?: boolean;
    details?: string;
  } | string; // Keep string for backward compatibility
  asthmaConditions?: string;
  otherMedicalComplications?: string;
  bloodPressureIssues?: string;
  seizureHistory?: string;
  psychoticEpisodes?: string;

  // Current Medications & Substances
  currentMedications?: {
    ssri?: boolean;
    antidepressants?: boolean;
    other?: boolean;
    otherDetails?: string;
    medications?: Array<{
      name: string;
      since: string;
      mgDaily: string;
      reason: string;
      frequency: string;
    }>;
  };
  recreationalDrugs?: string;
  vitaminsSupplements?: {
    vitaminD?: boolean;
    vitaminB12?: boolean;
    vitaminC?: boolean;
    omega3?: boolean;
    magnesium?: boolean;
    probiotics?: boolean;
    multivitamin?: boolean;
    kratom?: boolean;
    creatine?: boolean;
    other?: boolean;
    otherDetails?: string;
  };
  alcoholConsumption?: string;

  // Safety Considerations
  suicidalThoughts?: string;
  hospitalizations?: string;
  allergies?: string;
  medicalIssues?: string;

  // Administrative
  notes?: string;
  observations?: string;
  nzingoInsights?: string;
  followUpDate?: Date | string;
  screeningCompletedDate?: Date | string;
  rejectionReason?: string;
  convertedToClientId?: string;
  convertedDate?: Date | string;

  createdAt?: string;
  updatedAt?: string;
}

export interface Ceremony {
  _id?: string;
  retreatId: string;
  ceremonyNumber: number; // 1st, 2nd, 3rd ceremony etc.
  date: Date | string;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format

  // General ceremony notes
  majorNotes?: string;
  spiritualVerificationNotes?: string;

  // Medical checks (done before ceremony)
  medicalChecksCompleted?: boolean;
  medicalAdvisorApproval?: boolean;
  medicalAdvisorNotes?: string;
  medicalAdvisorName?: string;

  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  createdAt?: string;
  updatedAt?: string;
}

export interface CeremonyParticipant {
  _id?: string;
  ceremonyId: string;
  clientId: string;
  retreatId: string;

  // Pre-ceremony medical checks
  preCeremonyEkg?: {
    fileUrl?: string;
    fileName?: string;
    uploadedAt?: Date | string;
    approved?: boolean;
    notes?: string;
    reviewedBy?: string;
    reviewedAt?: Date | string;
  };

  preCeremonyBloodPressure?: {
    systolic?: number;
    diastolic?: number;
    pulse?: number;
    recordedAt?: Date | string;
    approved?: boolean;
    notes?: string;
    reviewedBy?: string;
    reviewedAt?: Date | string;
  };

  medicalClearance?: 'approved' | 'not_approved' | 'conditional' | 'pending';
  medicalClearanceNotes?: string;

  // Ceremony participation details
  participated?: boolean;
  arrivalTime?: string; // HH:MM when client arrived

  // Medicine intake
  spoonsTaken?: number;
  firstSpoonTime?: string; // HH:MM
  additionalSpoons?: Array<{
    spoonNumber: number;
    time: string; // HH:MM
    amount?: 'full' | 'half' | 'quarter';
  }>;

  // Purging information
  purged?: boolean;
  purgeTime?: string; // HH:MM first purge
  purgeDetails?: string;

  // Individual notes
  individualNotes?: string;
  experienceNotes?: string;
  facilitatorObservations?: string;

  // Post ceremony
  departureTime?: string; // HH:MM when client left
  postCeremonyStatus?: 'good' | 'needs_support' | 'monitoring' | 'medical_attention';
  postCeremonyNotes?: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface MedicalItem {
  _id?: string;
  display_id?: number;
  type: 'EKG' | 'Liver' | 'Question';
  image?: string; // URL or base64 image data
  files?: string[]; // Additional files (images, PDFs, documents)
  client_id: string;
  notes?: string;
  date_received?: Date | string;
  medadvisor_review_date?: Date | string;
  medadvisor_review_result?: 'OK' | 'caution' | 'NOT OK';
  medadvisor_review_notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentRequest {
  _id?: string;
  clientId: string;
  retreatId: string;
  requestedAmount: number;
  fullPrice: number;
  currency: 'CZK' | 'EUR' | 'PLN' | 'USD';
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  requestType: 'deposit' | 'balance' | 'full_payment' | 'additional';
  requestDate: Date | string;
  dueDate?: Date | string;
  description?: string;
  notes?: string;
  paymentId?: string;
  paidDate?: Date | string;
  sentToClient?: boolean;
  clientNotified?: Date | string;
  remindersSent?: number;
  lastReminderDate?: Date | string;
  invoiceNumber?: string;
  isUrgent?: boolean;
  paymentInstructions?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}
