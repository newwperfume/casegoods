// Centralized High-Resolution Brand & Project Assets
const logoFull = '/assets/aistudio/CASEGOODS_LOGO_FINAL6.png';
import logoMark from './logo_mark.png';
const brandIconsBc = '/assets/aistudio/LOGO_4_IMAGES.png';
const brandIconsPdf = '/assets/aistudio/LOGO_4_IMAGES.png';
import businessCardFront from './business_card_front.png';
import businessCardBack from './business_card_back.png';

import renderFamilyRoom1 from './render_1064HEM_1.jpg';
import renderFamilyRoom2 from './render_1064HEM_2.jpg';
import renderFamilyRoom3 from './render_1064HEM_3.jpg';
import renderFamilyRoom4 from './render_1064HEM_4.jpg';

import renderWetBar5 from './render_1064HEM_5.jpg';
import renderWetBar6 from './render_1064HEM_6.jpg';
import renderWetBar7 from './render_1064HEM_7.jpg';

import cadKidsKitchenElevation from './cad_1070MCG_elevation.png';
import cadKidsKitchenSection from './cad_1070MCG_section.png';

export const ASSETS = {
  brand: {
    logoFull,
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
