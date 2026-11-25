// Centralized High-Resolution Brand & Project Assets
const logoFull = '/assets/casegoods_logo_1560.png';
const logoFullSrcSet =
  '/assets/casegoods_logo_800.png 800w, /assets/casegoods_logo_1560.png 1560w, /assets/casegoods_logo_2340.png 2340w';
const logoMark = '/assets/logo_mark.png';
const brandIconsBc = '/assets/aistudio/LOGO_4_IMAGES.png';
const brandIconsPdf = '/assets/aistudio/LOGO_4_IMAGES.png';
const businessCardFront = '/assets/business_card_front.png';
const businessCardBack = '/assets/business_card_back.png';

const renderFamilyRoom1 = '/assets/render_1064HEM_1.jpg';
const renderFamilyRoom2 = '/assets/render_1064HEM_2.jpg';
const renderFamilyRoom3 = '/assets/render_1064HEM_3.jpg';
const renderFamilyRoom4 = '/assets/render_1064HEM_4.jpg';

const renderWetBar5 = '/assets/render_1064HEM_5.jpg';
const renderWetBar6 = '/assets/render_1064HEM_6.jpg';
const renderWetBar7 = '/assets/render_1064HEM_7.jpg';

const cadKidsKitchenElevation = '/assets/cad_1070MCG_elevation.png';
const cadKidsKitchenSection = '/assets/cad_1070MCG_section.png';

export const ASSETS = {
  brand: {
    logoFull,
    logoFullSrcSet,
    logoMark,
    brandIconsBc,
    brandIconsPdf,
    businessCardFront,
    businessCardBack,
  },
  familyRoom: {
    sheet1FullElevation: renderFamilyRoom1,
    sheet2CornerReturn: renderFamilyRoom4,
    sheet3FlutedDetail: renderFamilyRoom2,
    sheet4JoineryDetail: renderFamilyRoom3,
  },
  wetBar: {
    sheet5OverheadLayout: renderWetBar5,
    sheet6TambourIsland: renderWetBar7,
    sheet7ColorBlockedDrawers: renderWetBar6,
  },
  kidsKitchen: {
    elevationA1: cadKidsKitchenElevation,
    sectionB1: cadKidsKitchenSection,
  },
} as const;
