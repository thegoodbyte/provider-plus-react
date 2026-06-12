import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { housesApi, medicalArtifactsApi, medicalReviewRequestsApi, paymentsApi } from '../services/api';
import { MedicalArtifact, MedicalReviewRequest, Payment } from '../types';

interface BookingConfirmationPDFProps {
  booking: any;
  language?: 'pl' | 'cz' | 'en';
  onComplete?: () => void;
}

const waitForImages = async (container: HTMLElement) => {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.onload = () => resolve();
      image.onerror = () => resolve();
    });
  }));
};

const positiveReviewStatuses = new Set(['reviewed', 'approved', 'completed', 'caution']);
const negativeReviewStatuses = new Set(['rejected', 'declined', 'needs_resubmission']);

const escapeHtml = (value: any) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));

const getArtifactTime = (artifact: MedicalArtifact) =>
  new Date(artifact.receivedAt || artifact.createdAt || 0).getTime();

const getReviewTime = (review: MedicalReviewRequest) =>
  new Date(review.reviewedAt || review.requestedAt || review.createdAt || 0).getTime();

const getReviewStatus = (review?: MedicalReviewRequest) =>
  String(review?.reviewDecision || review?.status || '').toLowerCase();

const isArtifactVerified = (artifact?: MedicalArtifact, review?: MedicalReviewRequest) => {
  const artifactStatus = String(artifact?.status || '').toLowerCase();
  const reviewStatus = getReviewStatus(review);
  if (negativeReviewStatuses.has(reviewStatus) || negativeReviewStatuses.has(artifactStatus)) return false;
  return positiveReviewStatuses.has(reviewStatus) || positiveReviewStatuses.has(artifactStatus);
};

const isValidDate = (date: Date) => !Number.isNaN(date.getTime());

const parseDate = (value: any): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return isValidDate(date) ? date : null;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const resolveHouseForRetreat = async (retreat: any) => {
  const houseValue = retreat?.houseId || retreat?.house;
  if (!houseValue) return null;
  if (typeof houseValue === 'object') return houseValue;

  try {
    const response = await housesApi.getOne(String(houseValue));
    return response.data || null;
  } catch (error) {
    console.warn('Unable to load retreat house for booking PDF:', error);
    return null;
  }
};

const paymentDateFields = (source: any) => [
  source?.paymentDate,
  source?.paidDate,
  source?.processedDate,
  source?.createdAt,
];

const getFirstPaymentDateFromPayments = (payments: Payment[]) => {
  const dateFrom = (paymentList: Payment[]) => paymentList
    .map((payment) => paymentDateFields(payment).map(parseDate).find(Boolean))
    .filter(Boolean) as Date[];

  const paidPayments = dateFrom(payments.filter((payment) => payment.status === 'completed'));
  if (paidPayments.length === 0) return null;
  return paidPayments.sort((a, b) => a.getTime() - b.getTime())[0];
};

const resolveInitialPaymentDate = async (booking: any) => {
  const bookingId = booking?._id || booking?.id;
  const bookingHash = booking?.bookingHash;

  try {
    if (bookingHash) {
      const response = await paymentsApi.getByBookingHash(bookingHash);
      const paymentDate = getFirstPaymentDateFromPayments(response.data || []);
      if (paymentDate) return paymentDate;
    }
  } catch (error) {
    console.warn('Unable to load booking payments by hash for PDF deadlines:', error);
  }

  try {
    if (bookingId) {
      const response = await paymentsApi.getByBooking(bookingId);
      const paymentDate = getFirstPaymentDateFromPayments(response.data || []);
      if (paymentDate) return paymentDate;
    }
  } catch (error) {
    console.warn('Unable to load booking payments by ID for PDF deadlines:', error);
  }

  const paymentRequest = booking?.paymentRequestId || booking?.paymentRequest;
  const fallbackFields = [
    ...paymentDateFields(paymentRequest),
    booking?.paymentDate,
    booking?.paidDate,
    booking?.bookingDate,
    booking?.registrationDate,
    booking?.createdAt,
  ];
  return fallbackFields.map(parseDate).find(Boolean) || new Date();
};

const buildRequirementStatus = async (booking: any) => {
  const bookingId = booking?._id || booking?.id;
  const fallback = {
    status: 'conditional',
    ekgVerified: false,
    liverVerified: false,
    contractSigned: false,
    missingRequirements: ['EKG review', 'liver panel review', 'signed participant agreement'],
  };

  if (!bookingId) return fallback;

  try {
    const artifactsResponse = await medicalArtifactsApi.getAll({ bookingId });
    const artifacts: MedicalArtifact[] = artifactsResponse.data || [];
    const relevantArtifacts = artifacts.filter((artifact) => ['ekg', 'liver_panel', 'contract'].includes(artifact.artifactType));
    const reviewEntries = await Promise.all(
      relevantArtifacts
        .filter((artifact) => artifact._id)
        .map(async (artifact) => {
          try {
            const reviewsResponse = await medicalReviewRequestsApi.getByArtifact(artifact._id!);
            const latestReview = [...(reviewsResponse.data || [])].sort((a, b) => getReviewTime(b) - getReviewTime(a))[0];
            return [artifact._id!, latestReview] as const;
          } catch {
            return [artifact._id!, undefined] as const;
          }
        })
    );
    const reviewsByArtifact = Object.fromEntries(reviewEntries);
    const latestArtifact = (type: string) => relevantArtifacts
      .filter((artifact) => artifact.artifactType === type && (artifact.files || []).length > 0)
      .sort((a, b) => getArtifactTime(b) - getArtifactTime(a))[0];

    const ekgArtifact = latestArtifact('ekg');
    const liverArtifact = latestArtifact('liver_panel');
    const contractArtifact = latestArtifact('contract');
    const ekgVerified = isArtifactVerified(ekgArtifact, ekgArtifact?._id ? reviewsByArtifact[ekgArtifact._id] : undefined);
    const liverVerified = isArtifactVerified(liverArtifact, liverArtifact?._id ? reviewsByArtifact[liverArtifact._id] : undefined);
    const contractSigned = Boolean(contractArtifact);
    const missingRequirements = [
      !ekgVerified ? 'EKG review' : '',
      !liverVerified ? 'liver panel review' : '',
      !contractSigned ? 'signed participant agreement' : '',
    ].filter(Boolean);

    return {
      status: missingRequirements.length > 0 ? 'conditional' : 'confirmed',
      ekgVerified,
      liverVerified,
      contractSigned,
      missingRequirements,
    };
  } catch (error) {
    console.error('Error loading booking requirements for PDF:', error);
    return fallback;
  }
};

// Translation object for all supported languages
const translations = {
  pl: {
    title: 'Potwierdzenie wpłaty',
    date: 'Data',
    number: 'Numer',
    participant: 'Uczestnik',
    name: 'Na imię',
    address: 'Adres',
    email: 'Email',
    phone: 'Tel',
    bookingStatus: 'Status rezerwacji',
    confirmedStatus: 'Potwierdzona',
    conditionalStatus: 'Warunkowa',
    requirementsTitle: 'Warunki rezerwacji',
    ekgStatus: 'EKG',
    liverStatus: 'Panel wątroby',
    contractStatus: 'Umowa uczestnika',
    verified: 'zweryfikowano',
    pending: 'wymagane',
    conditionalNotice: 'Ta rezerwacja pozostaje warunkowa do czasu spełnienia poniższych wymagań:',
    initialPaymentDate: 'Data pierwszej płatności',
    deadline: 'Termin',
    medicalDeadline: 'EKG i panel wątroby należy dostarczyć w ciągu 21 dni od pierwszej płatności.',
    contractDeadline: 'Umowę uczestnika należy podpisać w ciągu 3 dni od pierwszej płatności.',
    deadlinePolicy: 'Jeśli terminy nie zostaną dotrzymane, rezerwacja może zostać przeniesiona na następny dostępny termin, aby miejsce mogło zostać zaoferowane osobom gotowym do kontynuowania.',
    retreatDescription: 'Pobyt uzdrawiający psychoduchowo z dwiema ceremoniami Missoko Bwiti Iboga, zakwaterowaniem (pokój Aleksism) i wyżywieniem.',
    location: 'Miejsce',
    dates: 'Data',
    addressLabel: 'Adres',
    googleMaps: 'Google maps',
    // Table headers
    presentation: 'Prezentacja',
    tableDate: 'Data',
    reference: 'Reference',
    price: 'Cena',
    deposit: 'Zaliczka',
    balance: 'Balans',
    currency: 'zł',
    // Footer notes
    footerNote1: 'Pozostałą kwotę najlepiej uregulować w USD.',
    footerNote2: 'Jeśli chcesz, śmiało skontaktuj się ze mną przed przysłaniem gotówki — z przyjemnością podam aktualny kurs wymiany. Dziękuję',
    footerNote3: 'Należy pamiętać, że żadna usługa nie będzie świadczona, dopóki nie zostanie ona w pełni opłacona. Dziękuję za zrozumienie',
    footerNote4: 'Aby potwierdzić rezerwację, każdy uczestnik musi dostarczyć EKG i panel wątroby w ciągu 21 dni od pierwszej płatności oraz podpisać umowę uczestnika w ciągu 3 dni od pierwszej płatności.',
    footerNote5: 'Jednocześnie każdy uczestnik musi być czysty od wszelkich leków i niektórych leków (takich jak leki przeciwdepresyjne itp.) przez co najmniej 30 dni przed leczeniem.',
    footerNote6: 'Dziękuję za zrozumienie, Martin Haila',
    polska: 'Polska'
  },
  cz: {
    title: 'Potvrzení platby',
    date: 'Datum',
    number: 'Číslo',
    participant: 'Účastník',
    name: 'Jméno',
    address: 'Adresa',
    email: 'Email',
    phone: 'Tel',
    bookingStatus: 'Stav rezervace',
    confirmedStatus: 'Potvrzená',
    conditionalStatus: 'Podmíněná',
    requirementsTitle: 'Podmínky rezervace',
    ekgStatus: 'EKG',
    liverStatus: 'Jaterní panel',
    contractStatus: 'Smlouva účastníka',
    verified: 'ověřeno',
    pending: 'vyžadováno',
    conditionalNotice: 'Tato rezervace zůstává podmíněná, dokud nebudou splněny následující požadavky:',
    initialPaymentDate: 'Datum první platby',
    deadline: 'Termín',
    medicalDeadline: 'EKG a jaterní panel musí být dodány do 21 dnů od první platby.',
    contractDeadline: 'Smlouva účastníka musí být podepsána do 3 dnů od první platby.',
    deadlinePolicy: 'Pokud termíny nebudou dodrženy, rezervace může být přesunuta na další dostupný termín, aby místo mohlo být nabídnuto lidem připraveným pokračovat.',
    retreatDescription: 'Psychospiritualní léčebný pobyt se dvěma ceremoniemi Missoko Bwiti Iboga, ubytováním (pokoj Aleksism) a stravováním.',
    location: 'Místo',
    dates: 'Datum',
    addressLabel: 'Adresa',
    googleMaps: 'Google mapy',
    // Table headers
    presentation: 'Prezentace',
    tableDate: 'Datum',
    reference: 'Reference',
    price: 'Cena',
    deposit: 'Záloha',
    balance: 'Zůstatek',
    currency: 'Kč',
    // Footer notes
    footerNote1: 'Zbývající částku je nejlepší uhradit v USD.',
    footerNote2: 'Pokud chcete, neváhejte mě kontaktovat před odesláním hotovosti — rád vám sdělím aktuální směnný kurz. Děkuji',
    footerNote3: 'Pamatujte, že žádná služba nebude poskytována, dokud nebude plně uhrazena. Děkuji za pochopení',
    footerNote4: 'Pro potvrzení rezervace musí každý účastník dodat EKG a jaterní panel do 21 dnů od první platby a podepsat smlouvu účastníka do 3 dnů od první platby.',
    footerNote5: 'Současně musí být každý účastník čistý od všech léků a některých léků (jako jsou antidepresiva atd.) po dobu nejméně 30 dnů před léčbou.',
    footerNote6: 'Děkuji za pochopení, Martin Haila',
    polska: 'Česká republika'
  },
  en: {
    title: 'Payment Confirmation',
    date: 'Date',
    number: 'Number',
    participant: 'Participant',
    name: 'Name',
    address: 'Address',
    email: 'Email',
    phone: 'Phone',
    bookingStatus: 'Booking Status',
    confirmedStatus: 'Confirmed',
    conditionalStatus: 'Conditional',
    requirementsTitle: 'Booking Conditions',
    ekgStatus: 'EKG',
    liverStatus: 'Liver Panel',
    contractStatus: 'Participant Agreement',
    verified: 'verified',
    pending: 'required',
    conditionalNotice: 'This reservation remains conditional until the following requirements are completed:',
    initialPaymentDate: 'Initial payment date',
    deadline: 'Deadline',
    medicalDeadline: 'EKG and liver panel must be provided within 21 days of the initial payment.',
    contractDeadline: 'The participant agreement must be signed within 3 days of the initial payment.',
    deadlinePolicy: 'If these deadlines are missed, the reservation may be moved to the next available retreat date so the spot can be offered to people who are ready to proceed.',
    retreatDescription: 'Psycho-spiritual healing retreat with two Missoko Bwiti Iboga ceremonies, accommodation (Aleksism room) and meals.',
    location: 'Location',
    dates: 'Dates',
    addressLabel: 'Address',
    googleMaps: 'Google maps',
    // Table headers
    presentation: 'Description',
    tableDate: 'Date',
    reference: 'Reference',
    price: 'Price',
    deposit: 'Deposit',
    balance: 'Balance',
    currency: '€',
    // Footer notes
    footerNote1: 'The remaining amount is best paid in USD.',
    footerNote2: 'If you wish, feel free to contact me before sending cash — I will be happy to provide the current exchange rate. Thank you',
    footerNote3: 'Please note that no service will be provided until it is fully paid. Thank you for understanding',
    footerNote4: 'To confirm the reservation, each participant must provide EKG and liver panel results within 21 days of the initial payment and sign the participant agreement within 3 days of the initial payment.',
    footerNote5: 'At the same time, each participant must be clean of all drugs and certain medications (such as antidepressants, etc.) for at least 30 days before treatment.',
    footerNote6: 'Thank you for understanding, Martin Haila',
    polska: 'USA'
  }
};

export const createBookingConfirmationPdf = async ({ booking, language = 'pl' }: BookingConfirmationPDFProps) => {
  const client = booking.clientId || booking.clientDetails;
  const retreat = booking.retreatId || booking.retreatDetails;
  const house = await resolveHouseForRetreat(retreat);
  const requirementStatus = await buildRequirementStatus(booking);
  const initialPaymentDate = await resolveInitialPaymentDate(booking);

  // Get translations for selected language
  const t = translations[language];
  const medicalDeadlineDate = addDays(initialPaymentDate, 21);
  const contractDeadlineDate = addDays(initialPaymentDate, 3);
  const bookingStatusText = requirementStatus.status === 'confirmed' ? t.confirmedStatus : t.conditionalStatus;
  const bookingStatusColor = requirementStatus.status === 'confirmed' ? '#047857' : '#92400e';
  const bookingStatusBg = requirementStatus.status === 'confirmed' ? '#d1fae5' : '#fef3c7';
  const requirementRows = [
    { label: t.ekgStatus, complete: requirementStatus.ekgVerified, deadline: medicalDeadlineDate },
    { label: t.liverStatus, complete: requirementStatus.liverVerified, deadline: medicalDeadlineDate },
    { label: t.contractStatus, complete: requirementStatus.contractSigned, deadline: contractDeadlineDate },
  ];
  const missingRequirementsText = requirementStatus.missingRequirements.map(escapeHtml).join(', ');

  // Format currency amount based on language
  const formatAmount = (amount: number) => {
    if (language === 'pl') return `${amount.toFixed(2).replace('.', ',')} ${t.currency}`;
    if (language === 'cz') return `${amount.toFixed(2).replace('.', ',')} ${t.currency}`;
    return `${t.currency} ${amount.toFixed(2)}`;
  };

  // Get date locale based on language
  const getDateLocale = () => {
    switch (language) {
      case 'pl': return 'pl-PL';
      case 'cz': return 'cs-CZ';
      default: return 'en-US';
    }
  };

  const formatDate = (date: Date) => date.toLocaleDateString(getDateLocale());
  const retreatStartDate = parseDate(retreat?.startDate || retreat?.dates?.startDate);
  const retreatEndDate = parseDate(retreat?.endDate || retreat?.dates?.endDate);
  const locationTown = house?.generalTown || house?.city || retreat?.location || house?.name || 'N/A';
  const locationAddress = house?.address || retreat?.address || 'N/A';
  const googleMapLink = house?.googleMapLink || house?.google_map_link || retreat?.googleMapLink || retreat?.google_map_link || '';
  const retreatDateRange = [
    retreatStartDate ? formatDate(retreatStartDate) : null,
    retreatEndDate ? formatDate(retreatEndDate) : null,
  ].filter(Boolean).join(' - ') || 'N/A';
  const retreatDateRangeCompact = [
    retreatStartDate ? retreatStartDate.toLocaleDateString(getDateLocale(), { day: '2-digit', month: '2-digit' }) : null,
    retreatEndDate ? retreatEndDate.toLocaleDateString(getDateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : null,
  ].filter(Boolean).join('-') || retreatDateRange;
  const paymentDescription = `${locationTown} retreat ${retreatDateRangeCompact}`;

  // Create a temporary div for PDF content
  const pdfContent = document.createElement('div');
  pdfContent.style.position = 'absolute';
  pdfContent.style.left = '-9999px';
  pdfContent.style.width = '794px'; // A4 width in pixels at 96 DPI
  pdfContent.style.minHeight = '1123px'; // A4 height in pixels at 96 DPI
  pdfContent.style.padding = '40px 60px';
  pdfContent.style.backgroundColor = 'white';
  pdfContent.style.fontFamily = 'Arial, Helvetica, sans-serif';
  pdfContent.style.fontSize = '14px';
  pdfContent.style.color = '#374151';

  pdfContent.innerHTML = `
    <div style="width: 100%; min-height: 1043px; background-color: white; position: relative; overflow: hidden; color: #374151; font-weight: 400;">
      <img src="/images/tree/tree-svg-bg.webp" alt="" style="position: absolute; left: 50%; top: 50%; width: 76%; max-width: 620px; transform: translate(-50%, -48%); opacity: 0.075; z-index: 0; pointer-events: none;" />
      <div style="position: relative; z-index: 1;">
      <!-- Header with Logo and Company Info -->
      <table style="width: 100%; border: none; margin-bottom: 15px;">
        <tr>
          <td style="vertical-align: top; width: 300px; padding: 0;">
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
              <img src="/images/logo/iscz-logo-500w.png" style="width: 80px; height: 80px; margin-right: 15px;" />
              <div style="font-size: 13px; line-height: 1.3; color: #4b5563;">
                IbogaSpirit.cz<br>
                Náměstí 41<br>
                Mýto v Čechách<br>
                33805
              </div>
            </div>
          </td>
          <td style="text-align: right; vertical-align: top; padding: 0;">
            <div style="font-size: 12px; color: #4b5563; line-height: 1.4;">
              USA Mobil : +1 917 741 3162 (${language === 'pl' ? 'Użyj do WhatsApp' : language === 'cz' ? 'Použijte pro WhatsApp' : 'Use for WhatsApp'})<br>
              Email: info@ibogaspirit.cz
            </div>
          </td>
        </tr>
      </table>

      <!-- Title -->
      <h1 style="text-align: center; font-size: 28px; margin: 10px 0 15px 0; font-weight: 400; color: #1f2937;">
        ${t.title}
      </h1>

      <!-- Details in two columns -->
      <table style="width: 100%; margin-bottom: 30px; border: none;">
        <tr>
          <td style="vertical-align: top; width: 50%; padding: 0;">
            <table style="border: none;">
              <tr>
                <td style="font-size: 14px; padding: 3px 0; color: #4b5563;">${t.date}:</td>
                <td style="font-size: 14px; padding: 3px 0 3px 15px; font-weight: 600; color: #1f2937;">${new Date().toLocaleDateString(getDateLocale())}</td>
              </tr>
              <tr>
                <td style="font-size: 14px; padding: 3px 0; color: #4b5563;">${t.number}:</td>
                <td style="font-size: 14px; padding: 3px 0 3px 15px; font-weight: 600; color: #1f2937;">${booking.bookingNumber || '1201'}</td>
              </tr>
              <tr>
                <td style="font-size: 14px; padding: 3px 0; color: #4b5563;">${t.bookingStatus}:</td>
                <td style="font-size: 14px; padding: 3px 0 3px 15px;">
                  <span style="display: inline-block; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600; color: ${bookingStatusColor}; background: ${bookingStatusBg};">${bookingStatusText}</span>
                </td>
              </tr>
            </table>
          </td>
          <td style="text-align: right; vertical-align: top; padding: 0;">
            <div>
              <h3 style="font-size: 16px; margin: 0 0 10px 0; font-weight: 500; color: #1f2937;">${t.participant}</h3>
              <div style="font-size: 13px; line-height: 1.5; text-align: right;">
                <div style="margin-bottom: 2px;"><strong style="font-size: 14px;">${client ? `${client.firstName || client.fname} ${client.lastName || client.lname}` : 'N/A'}</strong></div>
                <div style="margin-bottom: 2px;">${t.name}: <strong>${client ? `${client.firstName || client.fname} ${client.lastName || client.lname}` : 'N/A'}</strong></div>
                <div style="margin-bottom: 8px;">${t.address}: ${client?.city || ''} ${client?.country || t.polska}</div>
                <div>
                  <div style="margin-bottom: 2px;">${t.email}: <strong>${client?.email || 'N/A'}</strong></div>
                  <div>${t.phone}: <strong>${client?.phone || 'N/A'}</strong></div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Info text -->
      <div style="margin: 25px 0 25px 0; font-size: 13px; line-height: 1.4;">
        <strong>${t.retreatDescription}</strong>
      </div>

      <!-- Location Details -->
      <div style="margin: 20px 0 25px 0; font-size: 13px; line-height: 1.7;">
        <table style="border: none;">
          <tr>
            <td style="padding: 2px 10px 2px 0; vertical-align: top;">${t.location}:</td>
            <td style="padding: 2px 0; font-weight: bold;">${escapeHtml(locationTown)}</td>
          </tr>
          <tr>
            <td style="padding: 2px 10px 2px 0; vertical-align: top;">${t.dates}:</td>
            <td style="padding: 2px 0; font-weight: bold;">${escapeHtml(retreatDateRange)}</td>
          </tr>
          <tr>
            <td style="padding: 2px 10px 2px 0; vertical-align: top;">${t.addressLabel}:</td>
            <td style="padding: 2px 0; font-weight: bold;">${escapeHtml(locationAddress)}</td>
          </tr>
          <tr>
            <td style="padding: 2px 10px 2px 0; vertical-align: top;">${t.googleMaps}:</td>
            <td style="padding: 2px 0;">${googleMapLink ? `<a href="${escapeHtml(googleMapLink)}" style="color: #0066cc; text-decoration: underline;">${escapeHtml(googleMapLink)}</a>` : 'N/A'}</td>
          </tr>
        </table>
      </div>

      <!-- Payment Table -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 25px; font-size: 13px;">
        <thead>
          <tr style="background-color: rgba(144,238,144,0.42);">
            <th style="border: 1px solid rgba(31,41,55,0.16); padding: 8px 10px; text-align: left; font-weight: 500;">${t.presentation}</th>
            <th style="border: 1px solid rgba(31,41,55,0.16); padding: 8px 10px; text-align: left; font-weight: 500;">${t.tableDate}</th>
            <th style="border: 1px solid rgba(31,41,55,0.16); padding: 8px 10px; text-align: left; font-weight: 500;">${t.reference}</th>
            <th style="border: 1px solid rgba(31,41,55,0.16); padding: 8px 10px; text-align: right; font-weight: 500;">${t.price}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid rgba(31,41,55,0.16); padding: 8px 10px;">${escapeHtml(paymentDescription)}</td>
            <td style="border: 1px solid rgba(31,41,55,0.16); padding: 8px 10px;"></td>
            <td style="border: 1px solid rgba(31,41,55,0.16); padding: 8px 10px;"></td>
            <td style="border: 1px solid rgba(31,41,55,0.16); padding: 8px 10px; text-align: right;">${formatAmount(7500)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid rgba(31,41,55,0.16); padding: 8px 10px;">${t.deposit}</td>
            <td style="border: 1px solid rgba(31,41,55,0.16); padding: 8px 10px;">${formatDate(initialPaymentDate)}</td>
            <td style="border: 1px solid rgba(31,41,55,0.16); padding: 8px 10px;">Revolut</td>
            <td style="border: 1px solid rgba(31,41,55,0.16); padding: 8px 10px; text-align: right;">${formatAmount(3000)}</td>
          </tr>
          <tr>
            <td colspan="3" style="border: 1px solid rgba(31,41,55,0.16); padding: 8px 10px; text-align: right; font-weight: 600;">${t.balance}</td>
            <td style="border: 1px solid rgba(31,41,55,0.16); padding: 8px 10px; text-align: right; font-weight: 600;">${formatAmount(4500)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Footer notes -->
      <div style="margin-top: 30px; font-size: 11px; line-height: 1.6; color: #4b5563;">
        <div style="font-style: italic; margin-bottom: 15px;">
          ${t.footerNote1}<br>
          ${t.footerNote2}
        </div>

        <div style="margin: 20px 0;">
          ${t.footerNote3}
        </div>

        <div style="margin-top: 16px; border: 1px solid rgba(31,41,55,0.16); border-radius: 6px; overflow: hidden; background: rgba(255,255,255,0.90);">
          <div style="padding: 6px 8px; font-size: 10px; font-weight: 600; color: ${bookingStatusColor}; background: ${bookingStatusBg};">
            ${t.requirementsTitle}: ${bookingStatusText}
            <span style="font-weight: 400; color: #4b5563;"> &nbsp; ${t.initialPaymentDate}: ${formatDate(initialPaymentDate)}</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; line-height: 1.25;">
            <tbody>
              <tr>
                ${requirementRows.map((row) => `
                  <td style="width: 33.33%; border-top: 1px solid rgba(31,41,55,0.10); border-right: 1px solid rgba(31,41,55,0.10); padding: 5px 6px; color: #4b5563; vertical-align: top;">
                    <strong>${row.label}</strong><br>
                    ${t.deadline}: ${formatDate(row.deadline)}<br>
                    <span style="color: ${row.complete ? '#047857' : '#92400e'}; font-weight: 600;">${row.complete ? t.verified : t.pending}</span>
                  </td>
                `).join('')}
              </tr>
            </tbody>
          </table>
          ${missingRequirementsText ? `
            <div style="padding: 5px 8px; border-top: 1px solid rgba(31,41,55,0.10); font-size: 9px; line-height: 1.25; color: #92400e;">
              ${t.conditionalNotice} ${missingRequirementsText}. ${t.deadlinePolicy}
            </div>
          ` : ''}
        </div>

        <div style="margin-top: 14px;">
          ${t.footerNote5}<br>
          ${t.footerNote6}
        </div>
      </div>
      </div>
    </div>
  `;

  document.body.appendChild(pdfContent);
  pdfContent.querySelectorAll<HTMLElement>('*').forEach((element) => {
    const color = element.style.color.toLowerCase();
    if (['#000', '#000000', 'black', 'rgb(0, 0, 0)'].includes(color)) element.style.color = '#1f2937';
    if (['#333', '#333333', 'rgb(51, 51, 51)'].includes(color)) element.style.color = '#4b5563';
    if (element.style.fontWeight === 'bold') element.style.fontWeight = '500';
  });
  pdfContent.querySelectorAll<HTMLElement>('strong').forEach((element) => {
    element.style.fontWeight = '500';
    element.style.color = '#1f2937';
  });

  try {
    await waitForImages(pdfContent);
    // Generate canvas from HTML with optimized quality
    const canvas = await html2canvas(pdfContent, {
      scale: 1.5, // Reduced from 2 to 1.5 for smaller file size
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true // Enable compression
    });

    // Convert to JPEG for better compression
    const imgData = canvas.toDataURL('image/jpeg', 0.92); // JPEG with 92% quality
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Add image to PDF, centered if needed
    let y = 0;
    if (imgHeight < pageHeight) {
      y = (pageHeight - imgHeight) / 2; // Center vertically if content is shorter than page
    }

    pdf.addImage(imgData, 'JPEG', 0, y, imgWidth, imgHeight);

    const fileName = `Booking_Confirmation_${booking.bookingNumber || 'Unknown'}_${language.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
    return { pdf, fileName, blob: pdf.output('blob') };
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF. Please try again.');
    throw error;
  } finally {
    document.body.removeChild(pdfContent);
  }
};

export const generateBookingPDF = async ({ booking, language = 'pl', onComplete }: BookingConfirmationPDFProps) => {
  const { pdf, fileName } = await createBookingConfirmationPdf({ booking, language });
  pdf.save(fileName);
  onComplete?.();
};

export default generateBookingPDF;
