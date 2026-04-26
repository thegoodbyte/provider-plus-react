import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface BookingConfirmationPDFProps {
  booking: any;
  language?: 'pl' | 'cz' | 'en';
  onComplete?: () => void;
}

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
    footerNote4: 'Każdy uczestnik musi także przedłożyć zapis swojego EKG i panelu wątroby do wglądu przez mój personel medyczny na miesiąc przed pobytem.',
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
    footerNote4: 'Každý účastník musí také předložit svůj EKG a jaterní panel k nahlédnutí mým lékařským personálem měsíc před pobytem.',
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
    footerNote4: 'Each participant must also submit their EKG and liver panel for review by my medical staff one month before the retreat.',
    footerNote5: 'At the same time, each participant must be clean of all drugs and certain medications (such as antidepressants, etc.) for at least 30 days before treatment.',
    footerNote6: 'Thank you for understanding, Martin Haila',
    polska: 'USA'
  }
};

export const generateBookingPDF = async ({ booking, language = 'pl', onComplete }: BookingConfirmationPDFProps) => {
  const client = booking.clientId || booking.clientDetails;
  const retreat = booking.retreatId || booking.retreatDetails;

  // Get translations for selected language
  const t = translations[language];

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
  pdfContent.style.color = '#000';

  pdfContent.innerHTML = `
    <div style="width: 100%; background: white;">
      <!-- Header with Logo and Company Info -->
      <table style="width: 100%; border: none; margin-bottom: 15px;">
        <tr>
          <td style="vertical-align: top; width: 300px; padding: 0;">
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
              <img src="/images/logo/iscz-logo-500w.png" style="width: 80px; height: 80px; margin-right: 15px;" />
              <div style="font-size: 13px; line-height: 1.3; color: #333;">
                IbogaSpirit.cz<br>
                Náměstí 41<br>
                Mýto v Čechách<br>
                33805
              </div>
            </div>
          </td>
          <td style="text-align: right; vertical-align: top; padding: 0;">
            <div style="font-size: 12px; color: #555; line-height: 1.4;">
              USA Mobil : +1 917 741 3162 (${language === 'pl' ? 'Użyj do WhatsApp' : language === 'cz' ? 'Použijte pro WhatsApp' : 'Use for WhatsApp'})<br>
              Email: info@ibogaspirit.cz
            </div>
          </td>
        </tr>
      </table>

      <!-- Title -->
      <h1 style="text-align: center; font-size: 28px; margin: 10px 0 15px 0; font-weight: 500; color: #000;">
        ${t.title}
      </h1>

      <!-- Details in two columns -->
      <table style="width: 100%; margin-bottom: 30px; border: none;">
        <tr>
          <td style="vertical-align: top; width: 50%; padding: 0;">
            <table style="border: none;">
              <tr>
                <td style="font-size: 14px; padding: 3px 0; color: #333;">${t.date}:</td>
                <td style="font-size: 14px; padding: 3px 0 3px 15px; font-weight: bold; color: #000;">${new Date().toLocaleDateString(getDateLocale())}</td>
              </tr>
              <tr>
                <td style="font-size: 14px; padding: 3px 0; color: #333;">${t.number}:</td>
                <td style="font-size: 14px; padding: 3px 0 3px 15px; font-weight: bold; color: #000;">${booking.bookingNumber || '1201'}</td>
              </tr>
            </table>
          </td>
          <td style="text-align: right; vertical-align: top; padding: 0;">
            <div>
              <h3 style="font-size: 16px; margin: 0 0 10px 0; font-weight: 600; color: #000;">${t.participant}</h3>
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
            <td style="padding: 2px 0; font-weight: bold;">Jindrichuv Hradec</td>
          </tr>
          <tr>
            <td style="padding: 2px 10px 2px 0; vertical-align: top;">${t.dates}:</td>
            <td style="padding: 2px 0; font-weight: bold;">${retreat?.startDate ? new Date(retreat.startDate).toLocaleDateString(getDateLocale()) : '28.03.2026'} - ${retreat?.endDate ? new Date(retreat.endDate).toLocaleDateString(getDateLocale()) : '04.04.2026'}</td>
          </tr>
          <tr>
            <td style="padding: 2px 10px 2px 0; vertical-align: top;">${t.addressLabel}:</td>
            <td style="padding: 2px 0; font-weight: bold;">Člunek 24, 378 61 Člunek, Czechia</td>
          </tr>
          <tr>
            <td style="padding: 2px 10px 2px 0; vertical-align: top;">${t.googleMaps}:</td>
            <td style="padding: 2px 0;"><a href="https://maps.app.goo.gl/c7E6vennGRUEPk9" style="color: #0066cc; text-decoration: underline;">https://maps.app.goo.gl/c7E6vennGRUEPk9</a></td>
          </tr>
        </table>
      </div>

      <!-- Payment Table -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 25px; font-size: 13px;">
        <thead>
          <tr style="background-color: #90EE90;">
            <th style="border: 1px solid rgba(0,0,0,0.5); padding: 8px 10px; text-align: left; font-weight: 600;">${t.presentation}</th>
            <th style="border: 1px solid rgba(0,0,0,0.5); padding: 8px 10px; text-align: left; font-weight: 600;">${t.tableDate}</th>
            <th style="border: 1px solid rgba(0,0,0,0.5); padding: 8px 10px; text-align: left; font-weight: 600;">${t.reference}</th>
            <th style="border: 1px solid rgba(0,0,0,0.5); padding: 8px 10px; text-align: right; font-weight: 600;">${t.price}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid rgba(0,0,0,0.5); padding: 8px 10px;">Jindrichuv Hradec retreat 28.03-04.04 2026</td>
            <td style="border: 1px solid rgba(0,0,0,0.5); padding: 8px 10px;"></td>
            <td style="border: 1px solid rgba(0,0,0,0.5); padding: 8px 10px;"></td>
            <td style="border: 1px solid rgba(0,0,0,0.5); padding: 8px 10px; text-align: right;">${formatAmount(7500)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid rgba(0,0,0,0.5); padding: 8px 10px;">${t.deposit}</td>
            <td style="border: 1px solid rgba(0,0,0,0.5); padding: 8px 10px;">8/3/2026</td>
            <td style="border: 1px solid rgba(0,0,0,0.5); padding: 8px 10px;">Revolut</td>
            <td style="border: 1px solid rgba(0,0,0,0.5); padding: 8px 10px; text-align: right;">${formatAmount(3000)}</td>
          </tr>
          <tr>
            <td colspan="3" style="border: 1px solid rgba(0,0,0,0.5); padding: 8px 10px; text-align: right; font-weight: bold;">${t.balance}</td>
            <td style="border: 1px solid rgba(0,0,0,0.5); padding: 8px 10px; text-align: right; font-weight: bold;">${formatAmount(4500)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Footer notes -->
      <div style="margin-top: 30px; font-size: 11px; line-height: 1.6; color: #333;">
        <div style="font-style: italic; margin-bottom: 15px;">
          ${t.footerNote1}<br>
          ${t.footerNote2}
        </div>

        <div style="margin: 20px 0;">
          ${t.footerNote3}
        </div>

        <div style="margin-top: 20px;">
          ${t.footerNote4}<br>
          ${t.footerNote5}<br>
          ${t.footerNote6}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(pdfContent);

  try {
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

    // Save PDF with language suffix
    const fileName = `Booking_Confirmation_${booking.bookingNumber || 'Unknown'}_${language.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);

    if (onComplete) {
      onComplete();
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF. Please try again.');
  } finally {
    document.body.removeChild(pdfContent);
  }
};

export default generateBookingPDF;