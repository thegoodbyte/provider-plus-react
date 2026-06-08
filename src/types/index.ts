export interface Retreat {
  _id?: string;
  name: string;
  retreatCode?: string;
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
  textColor?: string;
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
  language?: 'EN' | 'CZ' | 'PL' | 'RU' | 'OTHER';
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
  bloodPressureStatus?: 'higher' | 'normal' | 'lower' | string;
  bloodPressureValue?: string;
  seizureHistory?: string;
  psychoticEpisodes?: string;
  currentMedications?: string;
  recreationalDrugs?: string;
  vitaminsSupplements?: string | {
    vitaminD?: boolean;
    vitaminB12?: boolean;
    vitaminC?: boolean;
    omega3?: boolean;
    magnesium?: boolean;
    zinc?: boolean;
    iron?: boolean;
    probiotics?: boolean;
    multivitamin?: boolean;
    creatine?: boolean;
    other?: boolean;
    details?: string;
    otherDetails?: string;
  };
  alcoholConsumption?: string;
  suicidalThoughts?: string;
  hospitalizations?: string;
  allergies?: string;
  weightRange?: string;
  pregnancyStatus?: string;
  screeningCompletedDate?: Date | string;
  screeningData?: Record<string, any>;
  handwritingImageUrl?: string;
  profilePictureUrl?: string;
  profilePictureS3Key?: string;
  profilePictureFileUploadId?: string;
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
  bookingNumber?: number;
  bookingHash?: string; // 20-character alphanumeric hash for linking payments
  retreatId: string;
  clientId: string;
  paymentRequestId?: string | PaymentRequest;
  bookingType?: 'full_retreat' | 'booster'; // Type of booking
  registrationDate: Date | string;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  totalAmount: number;
  currency?: 'EUR' | 'USD' | 'CZK' | 'PLN';
  amountPaid?: number;
  status?: 'pending' | 'conditional' | 'confirmed' | 'approved' | 'declined' | 'moved' | 'checked-in' | 'checked-out' | 'cancelled';
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

export interface Note {
  _id?: string;
  title: string;
  content: string;
  type: 'client' | 'retreat' | 'general';
  clientId?: string | Client;
  retreatId?: string | Retreat;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  createdBy?: string;
  creator?: string;
  isArchived?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  key?: string;
  name: string;
  description?: string;
  category: 'accommodation' | 'transport' | 'food' | 'activities' | 'staff' | 'utilities' | 'general';
  defaultCurrency?: string;
  defaultAmount?: number;
  isActive?: boolean;
  seedManaged?: boolean;
  seedSource?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RetreatExpense {
  _id?: string;
  retreatId: string;
  expenseTypeId: string | ExpenseType;
  amount: number;
  usd_amount?: number;
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
  totalExpensesUSD?: number;
  expensesByCategory: Record<string, number>;
  expensesByCategoryUSD?: Record<string, number>;
  expensesByStatus: Record<string, number>;
  expensesByStatusUSD?: Record<string, number>;
  expensesByCurrency: Record<string, number>;
  count: number;
}

export interface Payment {
  _id?: string;
  clientId: string | Client;
  retreatId: string | Retreat;
  paymentRequestId?: string | PaymentRequest;
  bookingId?: string | RetreatClient; // Legacy - for backward compatibility
  bookingHash?: string; // New field - 20-character hash for linking to specific booking
  amount: number;
  usd_amount?: number;
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
  totalPaymentsUSD?: number;
  completedPayments: number;
  completedPaymentsEUR: number;
  completedPaymentsUSD?: number;
  pendingPayments: number;
  pendingPaymentsEUR: number;
  pendingPaymentsUSD?: number;
  refundedPayments: number;
  refundedPaymentsEUR: number;
  refundedPaymentsUSD?: number;
  paymentsByMethod: Record<string, number>;
  paymentsByStatus: Record<string, number>;
  depositsPaid: number;
  depositsEUR: number;
  depositsUSD?: number;
  finalPaymentsPaid: number;
  finalPaymentsEUR: number;
  finalPaymentsUSD?: number;
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
  bloodPressureStatus?: 'higher' | 'normal' | 'lower' | string;
  bloodPressureValue?: string;
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
    zinc?: boolean;
    iron?: boolean;
    probiotics?: boolean;
    multivitamin?: boolean;
    kratom?: boolean;
    creatine?: boolean;
    other?: boolean;
    details?: string;
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

  preCeremonyChecks?: Array<{
    id?: string;
    recordedAt?: Date | string;
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
  }>;

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

  eventLog?: Array<{
    id?: string;
    time: string;
    eventType: 'medicine' | 'purge' | 'launch' | 'abnormality' | 'note' | 'arrival' | 'departure';
    spoonCount?: number;
    spoonAmount?: 'full' | 'half' | 'quarter' | string;
    medicineForm?: 'spoon' | 'capsules' | 'tea' | 'other' | string;
    doseAmount?: string;
    severity?: 'low' | 'medium' | 'high' | 'urgent' | string;
    note?: string;
    recordedAt?: Date | string;
    recordedBy?: string;
  }>;

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
  clientDisplayId?: number;
  clientName?: string;
  firstName?: string;
  lastName?: string;
  type: 'EKG' | 'Liver' | 'Question';
  image?: string; // URL or base64 image data
  files?: string[]; // Additional files (images, PDFs, documents)
  client_id: string;
  retreatId?: string;
  notes?: string;
  date_received?: Date | string;
  medadvisor_review_date?: Date | string;
  medadvisor_review_result?: 'OK' | 'caution' | 'NOT OK';
  medadvisor_review_notes?: string;
  source?: string;
  uploadedAt?: Date | string;
  generalNotes?: string;
  ekgStatus?: string;
  liverPanelStatus?: string;
  ekgAdvisorNotes?: string;
  liverPanelAdvisorNotes?: string;
  ekgReceivedDate?: Date | string;
  liverPanelReceivedDate?: Date | string;
  ekgSentToAdvisorDate?: Date | string;
  liverPanelSentToAdvisorDate?: Date | string;
  ekgFilePath?: string;
  ekgFileName?: string;
  ekgFileSize?: number;
  ekgS3Key?: string;
  ekgUploadedAt?: Date | string;
  ekgTestDate?: Date | string;
  ekgSource?: string;
  liverPanelFilePath?: string;
  liverPanelFileName?: string;
  liverPanelFileSize?: number;
  liverPanelS3Key?: string;
  liverPanelUploadedAt?: Date | string;
  liverPanelTestDate?: Date | string;
  liverPanelSource?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MedicalArtifact {
  _id?: string;
  display_id?: number;
  clientId: string | Client;
  clientDisplayId?: number;
  retreatId?: string | Retreat;
  bookingId?: string;
  ceremonyId?: string;
  artifactType:
    | 'ekg'
    | 'ceremony_ekg'
    | 'blood_pressure'
    | 'liver_panel'
    | 'medications_form'
    | 'medication_list'
    | 'questionnaire'
    | 'food_intake'
    | 'contract'
    | 'question'
    | 'other';
  title: string;
  description?: string;
  textContent?: string;
  data?: Record<string, any>;
  files?: Array<{
    fileName?: string;
    filePath?: string;
    s3Key?: string;
    url?: string;
    thumbnailPath?: string;
    thumbnailS3Key?: string;
    thumbnailFileName?: string;
    thumbnailMimeType?: string;
    thumbnailSize?: number;
    thumbnailUrl?: string;
    mimeType?: string;
    size?: number;
    uploadedAt?: Date | string;
  }>;
  receivedAt?: Date | string;
  source?: 'client_upload' | 'admin_upload' | 'email' | 'manual' | 'legacy';
  version?: number;
  replacesArtifactId?: string | MedicalArtifact;
  status?: 'stored' | 'superseded' | 'voided';
  notes?: string;
  legacyMedicalTrackingId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FileUpload {
  _id?: string;
  fileHash: string;
  originalFileName: string;
  storedFileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  documentKind: 'medical_tracking' | 'medical_artifact' | 'client_medical' | 'client_profile_picture' | 'retreat_document' | 'other';
  foreignKey: string;
  uploadedBy?: string;
  uploadedAt?: Date | string;
  isActive?: boolean;
  description?: string;
  tags?: string[];
  accessLevel?: 'public' | 'private' | 'restricted';
  expiresAt?: Date | string;
  checksumMD5?: string;
  section?: string;
  storage?: 'local' | 's3';
  bucket?: string;
  thumbnailPath?: string;
  thumbnailFileName?: string;
  thumbnailMimeType?: string;
  thumbnailSize?: number;
  thumbnailConfig?: {
    width?: number;
    height?: number;
  };
}

export interface MedicalReviewRequest {
  _id?: string;
  display_id?: number;
  clientId: string | Client;
  clientDisplayId?: number;
  retreatId: string | Retreat;
  medicalTrackingId?: string | MedicalItem | ClientMedical;
  artifactIds?: Array<string | MedicalArtifact>;
  attemptNumber?: number;
  requestType:
    | 'ekg'
    | 'liver'
    | 'both'
    | 'ekg_review'
    | 'ceremony_ekg_review'
    | 'blood_pressure_review'
    | 'liver_panel_review'
    | 'medications_review'
    | 'questionnaire_review'
    | 'food_review'
    | 'medical_question'
    | 'general_clearance';
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'caution' | 'needs_resubmission' | 'completed';
  requestedAt?: Date | string;
  requestedBy?: string;
  requestedByUserId?: string | any;
  assignedTo?: string;
  assignedToUserId?: string | any;
  assignedToEmail?: string;
  accessTokenExpiresAt?: Date | string;
  lastNotificationSentAt?: Date | string;
  reviewedAt?: Date | string;
  reviewedBy?: string;
  reviewDecision?: 'OK' | 'caution' | 'NOT OK';
  reviewNotes?: string;
  overallNotes?: string;
  medicalStaffNotes?: string;
  fileReviews?: Array<{
    artifactId?: string;
    fileKey?: string;
    fileName?: string;
    decision?: 'OK' | 'caution' | 'NOT OK';
    notes?: string;
    reviewedAt?: Date | string;
    reviewedBy?: string;
  }>;
  ekgReviewDecision?: 'OK' | 'caution' | 'NOT OK';
  ekgReviewNotes?: string;
  liverReviewDecision?: 'OK' | 'caution' | 'NOT OK';
  liverReviewNotes?: string;
  previousReviewRequestId?: string | MedicalReviewRequest;
  source?: string;
  sourceSnapshot?: Record<string, any>;
  sourceType?: string;
  sourceFileName?: string;
  sourceFileSize?: number;
  sourceFilePath?: string;
  sourceS3Key?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BookingFlowTemplate {
  _id?: string;
  display_id?: number;
  retreatId?: string | Retreat | null;
  templateScope?: 'retreat' | 'global';
  workflowStage?: 'potential' | 'screening' | 'payment' | 'conditional_booking' | 'contract' | 'questionnaire' | 'medical' | 'prep' | 'approved' | 'cancelled';
  key: string;
  title: string;
  description?: string;
  category: 'screening' | 'booking' | 'payment' | 'contract' | 'questionnaire' | 'medical' | 'dietary' | 'message' | 'access' | 'approval' | 'reminder' | 'other';
  offsetDays: number;
  deadlineBasis?: 'after_signup' | 'after_booking' | 'before_retreat_start' | 'manual';
  active?: boolean;
  isBlocking?: boolean;
  order?: number;
  createsTask?: boolean;
  taskTitle?: string;
  taskPriority?: 'low' | 'medium' | 'high' | 'urgent';
  triggerType?: string;
  reviewRequired?: boolean;
  readinessGroup?: string;
  expectedArtifact?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BookingFlowItem {
  _id?: string;
  display_id?: number;
  bookingId: string | RetreatClient;
  clientId: string | Client;
  retreatId: string | Retreat;
  templateId?: string | BookingFlowTemplate;
  key: string;
  title: string;
  description?: string;
  category: 'screening' | 'booking' | 'payment' | 'contract' | 'questionnaire' | 'medical' | 'dietary' | 'message' | 'access' | 'approval' | 'reminder' | 'other';
  offsetDays: number;
  dueDate?: Date | string | null;
  status: 'pending' | 'sent' | 'received' | 'sent_for_review' | 'in_review' | 'reviewed' | 'approved' | 'caution' | 'rejected' | 'needs_resubmission' | 'completed' | 'blocked' | 'waived' | 'scheduled';
  isBlocking?: boolean;
  order?: number;
  source?: string;
  notes?: string;
  completedAt?: Date | string;
  sentAt?: Date | string;
  receivedAt?: Date | string;
  reviewedAt?: Date | string;
  reviewDecision?: 'OK' | 'caution' | 'NOT OK';
  reviewNotes?: string;
  reviewedBy?: string;
  approvedAt?: Date | string;
  assignedTo?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface BookingFlowGate {
  key: string;
  label: string;
  satisfied: boolean;
  required: boolean;
  itemStatus?: string;
  note?: string;
}

export interface BookingFlowProgress {
  bookingId: string;
  bookingStatus: string;
  recommendedStatus: string;
  canApprove: boolean;
  blockedBy?: string[];
  gates: BookingFlowGate[];
}

export interface PaymentRequest {
  _id?: string;
  display_id?: number;
  clientId: string;
  retreatId: string;
  paymentDate: Date | string;
  paymentType: 'CSOB' | 'Paypal' | 'Revolut' | 'Wise' | 'Cash' | 'Other';
  fullPriceQuote: number;
  amountPaid: number;
  usd_amount?: number;
  fullPriceUsdAmount?: number;
  currency: 'CZK' | 'EUR' | 'PLN' | 'USD';
  note?: string;
  status: 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  invoiceNumber?: string;
  publicHash?: string;
  dueDate?: Date | string;
  paidDate?: Date | string;
  sentAt?: Date | string;
  lastReminderAt?: Date | string;
  remindersSent?: number;
  isUrgent?: boolean;
  paymentInstructions?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  requestDate?: Date | string;
  requestType?: 'deposit' | 'balance' | 'full_payment' | 'additional';
  requestedAmount?: number;
  fullPrice?: number;
  notes?: string;
  paymentId?: string;
  sentToClient?: boolean;
  clientNotified?: Date | string;
  lastReminderDate?: Date | string;
}

export interface MailSettings {
  provider?: 'gmail';
  connected?: boolean;
  senderName?: string;
  senderEmail?: string;
  replyTo?: string;
  gmailUserEmail?: string;
  gmailAccountName?: string;
  scopes?: string[];
  tokenExpiry?: string | Date;
  lastConnectedAt?: string | Date;
  lastTestAt?: string | Date;
  lastError?: string;
  oauthConfigured?: boolean;
  authUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmailTemplate {
  _id?: string;
  display_id?: number;
  name: string;
  description?: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  category?: string;
  active?: boolean;
  notes?: string;
  tags?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SentEmail {
  _id?: string;
  display_id?: number;
  templateId?: string | EmailTemplate;
  templateName?: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  attachments?: Array<{
    fileName: string;
    mimeType?: string;
    size?: number;
  }>;
  to: string[];
  cc?: string[];
  bcc?: string[];
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  provider?: string;
  status?: 'queued' | 'sent' | 'failed' | 'draft';
  gmailMessageId?: string;
  clientId?: string | Client;
  retreatId?: string | Retreat;
  clientDisplayId?: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
  errorMessage?: string;
  sentAt?: string | Date;
  createdBy?: string;
  variablesSnapshot?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}
