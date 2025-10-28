import dotenv from 'dotenv';
dotenv.config();

const parseJson = (v, fb) => { try { return JSON.parse(v); } catch { return fb; } };

export const config = {
  db: {
    host:     process.env.DB_HOST || 'localhost',
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'ra3_main',
    port:     Number(process.env.DB_PORT || 3306),
  },

  schema: {
    // accounts
    table:        process.env.ACCOUNTS_TABLE            || 'accounts',
    idCol:        process.env.ACCOUNTS_ID_COL           || 'login',
    userCol:      process.env.ACCOUNTS_USERNAME_COL     || 'login',
    emailCol:     process.env.ACCOUNTS_EMAIL_COL        || 'email',
    passwordCol:  process.env.ACCOUNTS_PASSWORD_COL     || 'password',
    redbucksCol:  process.env.ACCOUNTS_REDBUCKS_COL     || 'redbucks',
    viplvlCol:    process.env.ACCOUNTS_VIPLVL_COL       || 'viplvl',
    vipdateCol:   process.env.ACCOUNTS_VIPDATE_COL      || 'vipdate',
    character1Col:process.env.ACCOUNTS_CHARACTER1_COL   || 'character1',
    avatarCol:    process.env.ACCOUNTS_AVATAR_COL       || 'avatar_url',

    // characters
    charTable:        process.env.CHAR_TABLE            || 'characters',
    charUuidCol:      process.env.CHAR_UUID_COL         || 'uuid',
    charFirstCol:     process.env.CHAR_FIRST_COL        || 'firstname',
    charLastCol:      process.env.CHAR_LAST_COL         || 'lastname',
    charGenderCol:    process.env.CHAR_GENDER_COL       || 'gender',
    charLevelCol:     process.env.CHAR_LEVEL_COL        || 'lvl',
    charMoneyCol:     process.env.CHAR_MONEY_COL        || 'money',
    charBankCol:      process.env.CHAR_BANK_COL         || 'bank',
    charFactionCol:   process.env.CHAR_FACTION_COL      || 'fraction',
    charFactionLvlCol:process.env.CHAR_FACTIONLVL_COL   || 'fractionlvl',
    charAdminLvlCol:  process.env.CHAR_ADMINLVL_COL     || 'adminlvl',

    // customization (uuid = characters.uuid)
    customTable:      process.env.CUSTOMIZATION_TABLE        || 'customization',
    customUuidCol:    process.env.CUSTOMIZATION_UUID_COL     || 'uuid',
    customAvatarCol:  process.env.CUSTOMIZATION_AVATAR_COL   || 'avatar_url',

    // houses
    housesTable:   process.env.HOUSES_TABLE      || 'houses',
    houseIdCol:    process.env.HOUSES_ID_COL     || 'id',
    houseNameCol:  process.env.HOUSES_NAME_COL   || 'name',
    housePriceCol: process.env.HOUSES_PRICE_COL  || 'price',   // în CENTS
    houseOwnerCol: process.env.HOUSES_OWNER_COL  || 'owner',   // uuid din characters

    // sanctions on accounts
    banCol:        process.env.CHARACTERS_BAN_COL   || 'IsBannedMP',
    warnsCol:      process.env.CHARACTERS_WARNS_COL || 'Warns',
  },

  app: {
    baseUrl:   process.env.APP_BASE_URL || 'http://localhost:3000',
    port:      Number(process.env.PORT || 3000),
  },

  shop: {
    currency:  process.env.CURRENCY || 'eur',
    packages:  parseJson(process.env.SHOP_PACKAGES || '[]', []),
  },

  ragemp: {
    host: process.env.RAGEMP_HOST || '91.200.220.66',
    port: Number(process.env.RAGEMP_PORT || 22005)
  },

  stripe: {
    secret: process.env.STRIPE_SECRET_KEY || '',
    publishable: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    prices: {
      starter: process.env.STRIPE_PRICE_STARTER || '',
      gamer:   process.env.STRIPE_PRICE_GAMER   || '',
      whale:   process.env.STRIPE_PRICE_WHALE   || '',
    }
  }
};
