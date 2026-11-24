// Bastion rules data. Mechanics are summarised in short form; consult your rulebooks for full text.

export const SPACE = { Cramped: 4, Roomy: 16, Vast: 36 };
export const SPACES = ['Cramped', 'Roomy', 'Vast'];

export const BASIC_TYPES = ['Bedroom', 'Dining Room', 'Parlor', 'Courtyard', 'Kitchen', 'Storage'];
export const BASIC_ADD = { Cramped: { cost: 500, days: 20 }, Roomy: { cost: 1000, days: 45 }, Vast: { cost: 3000, days: 125 } };
export const BASIC_ENLARGE = { Cramped: { to: 'Roomy', cost: 500, days: 25 }, Roomy: { to: 'Vast', cost: 2000, days: 80 } };
export const WALL = { cost: 250, days: 10 };

export const SLOTS_BY_LEVEL = [[17, 6], [13, 5], [9, 4], [5, 2]];

export const SOURCES = {
  DMG: "Dungeon Master's Guide",
  FR: 'Forgotten Realms: Heroes of Faerûn',
  EB: 'Eberron: Forge of the Artificer',
  RL: 'Ravenloft: The Horrors Within',
  AU: 'Arcana Unleashed',
};

export const TRAITS = {
  arcane: 'Can use an Arcane Focus or a tool as a Spellcasting Focus',
  divine: 'Can use a Holy Symbol or Druidic Focus as a Spellcasting Focus',
  focus: 'Can use some other Spellcasting Focus',
  artisan: "Can use Artisan's Tools as a Spellcasting Focus",
  expertise: 'Has Expertise in a skill',
  martial: 'Has a Fighting Style or Unarmored Defense feature',
  medicine: 'Proficient in the Medicine skill',
};

export const MEMBERSHIPS = {
  purpledragon: 'Purple Dragon Knights',
  harpers: 'Harpers',
  redwizards: 'Red Wizards',
  zhentarim: 'Zhentarim',
  emerald: 'Emerald Enclave',
  lordsalliance: "Lords' Alliance",
  gauntlet: 'Order of the Gauntlet',
  cultdragon: 'Cult of the Dragon',
  dragonmarked: 'Renown 10+ with a dragonmarked house',
  kundarak: 'Renown 15+ with House Kundarak',
  orien: 'Renown 15+ with House Orien',
  lyrandar: 'Renown 25+ with House Lyrandar',
  bejeweled: 'Bejeweled Conclave',
  crucible: 'Crucible Keepers',
  covenant: 'Covenant of the Grave',
  sheltering: 'Sheltering Hands',
  cosmicdawn: 'Bringers of Cosmic Dawn',
  phantasmic: 'Phantasmic Circus',
  ninthquill: 'Ninth Quill',
  seers: 'Seers of Sea and Sky',
  horizon: 'Horizon Weavers',
};

export const ORDERS = ['Craft', 'Empower', 'Harvest', 'Recruit', 'Research', 'Trade'];

// --- option helpers -------------------------------------------------------
const what = (label, choices) => ({ k: 'what', label, choices });
const askCost = (label = 'Cost (GP)') => ({ k: 'cost', label, num: true });
const askDays = (label = 'Days required') => ({ k: 'days', label, num: true });
const opt = (order, name, text, x = {}) => ({ order, name, text, days: 7, cost: 0, fx: 'log', ...x });
const magicItem = (order, table) =>
  opt(order, `Magic Item (${table})`, `Craft a Common or Uncommon item from the ${table} tables. Enter the crafting time and cost from the magic item crafting rules. Items that cast spells must be crafted by you with those spells prepared.`, {
    minLevel: 9, fx: 'item', ask: [what('Item'), askDays(), askCost()],
  });
const charm = (name, spell, where = 'your Bastion') => ({ name, text: `After a Long Rest in ${where} you gain a Charm (7 days or until used) to cast ${spell} without a spell slot. You can't regain it while you still have it.` });
const VAST = (text, x = {}) => ({ to: 'Vast', cost: 2000, text, ...x });

const fac = (key, name, src, level, space, hirelings, prereq, x) => ({ key, name, src, level, space, hirelings, prereq, options: [], passives: [], ...x });

export const FACILITIES = [
  // ---------------- Dungeon Master's Guide ----------------
  fac('arcane-study', 'Arcane Study', 'DMG', 5, 'Roomy', 1, ['arcane'], {
    desc: 'A quiet place of research with desks and bookshelves.',
    passives: [charm('Arcane Study Charm', 'Identify (no Material components)')],
    options: [
      opt('Craft', 'Arcane Focus', 'The hireling crafts an Arcane Focus.', { fx: 'item', yield: 'Arcane Focus' }),
      opt('Craft', 'Book', 'The hireling crafts a blank book.', { cost: 10, fx: 'item', yield: 'Blank book' }),
      magicItem('Craft', 'Arcana'),
    ],
  }),
  fac('archive', 'Archive', 'DMG', 13, 'Roomy', 1, [], {
    desc: 'A repository of valuable books, maps, and scrolls.',
    passives: [{ name: 'Reference Book', text: 'While you and the book are in your Bastion, you have Advantage on Study checks for the matching skill.' }],
    config: [{ k: 'books', label: 'Reference books', count: 1, vastCount: 3, choices: ["Bigby's Handy Arcana Codex (Arcana)", 'The Chronepsis Chronicles (History)', 'Investigations of the Inquisitive (Investigation)', 'Material Musings on the Nature of the World (Nature)', 'The Old Faith and Other Religions (Religion)'] }],
    options: [opt('Research', 'Helpful Lore', 'The hireling learns lore as if by Legend Lore and shares it when you next speak.', { ask: [what('Subject')] })],
    enlarge: VAST('Gain two additional reference books.'),
  }),
  fac('armory', 'Armory', 'DMG', 5, 'Roomy', 1, [], {
    desc: 'Racks, mannequins and chests of arms and armor for your defenders.',
    passives: [{ name: 'Stocked Armory', text: 'While stocked, roll d8s instead of d6s when checking for lost Bastion Defenders. The stock is used up after any such event.' }],
    options: [opt('Trade', 'Stock Armory', 'Costs 100 GP plus 100 GP per Bastion Defender (halved if you have a Smithy).', { days: 0, fx: 'armory' })],
  }),
  fac('barrack', 'Barrack', 'DMG', 5, 'Roomy', 1, [], {
    multiple: true, houses: 12, housesVast: 25,
    desc: 'Sleeping quarters for up to twelve Bastion Defenders.',
    options: [opt('Recruit', 'Bastion Defenders', 'Up to four Bastion Defenders join and are quartered here. Free.', { days: 0, fx: 'defenders' })],
    enlarge: VAST('Houses up to twenty-five Bastion Defenders.'),
  }),
  fac('demiplane', 'Demiplane', 'DMG', 17, 'Vast', 1, ['arcane'], {
    desc: 'An extradimensional stone room behind a door only you and your hirelings can open.',
    passives: [{ name: 'Fabrication', text: 'Once per Long Rest, take a Magic action in the Demiplane to create a nonmagical object (max 5 ft., 5 GP) of common materials.' }],
    options: [opt('Empower', 'Arcane Resilience', 'Runes last 7 days: after a full Long Rest in the Demiplane, gain Temporary Hit Points equal to 5 × your level.', { days: 0, fx: 'buff', buff: 'Arcane Resilience: temp HP = 5 × level after a Long Rest in the Demiplane', buffDays: 7 })],
  }),
  fac('gaming-hall', 'Gaming Hall', 'DMG', 9, 'Vast', 4, [], {
    desc: 'Chess, darts, cards and dice for recreation.',
    options: [opt('Trade', 'Gambling Hall', 'Runs as a gambling den for 7 days; roll d100 for your share of the winnings.', { fx: 'gamble' })],
  }),
  fac('garden', 'Garden', 'DMG', 5, 'Roomy', 1, [], {
    multiple: true,
    desc: 'A garden of one type (two if Vast). Changing type takes 21 days of no other activity.',
    config: [{ k: 'types', label: 'Garden type', count: 1, vastCount: 2, repeat: true, choices: ['Decorative', 'Food', 'Herb', 'Poison'] }],
    options: [opt('Harvest', 'Garden Growth', 'Decorative: ten bouquets (5 GP each), Perfume vials, or Candles. Food: 100 days of Rations. Herb: ten Healer\'s Kits or one Potion of Healing. Poison: two Antitoxin or one Basic Poison.', { fx: 'garden' })],
    enlarge: VAST('Counts as two Roomy Gardens, each producing its own harvest. Gains one hireling.', { hirelings: 1 }),
  }),
  fac('greenhouse', 'Greenhouse', 'DMG', 9, 'Roomy', 1, [], {
    desc: 'A climate-controlled enclosure for rare plants and fungi.',
    passives: [{ name: 'Fruit of Restoration', text: 'One plant bears three fruits, regrown daily at dawn. Eating one grants Lesser Restoration; fruit loses its magic 24 hours after picking.' }],
    options: [
      opt('Harvest', 'Healing Herbs', 'The hireling brews a Potion of Healing (greater).', { fx: 'item', yield: 'Potion of Healing (greater)' }),
      opt('Harvest', 'Poison', 'The hireling extracts one application of a poison.', { fx: 'item', ask: [what('Poison', ["Assassin's Blood", 'Malice', 'Pale Tincture', 'Truth Serum'])] }),
    ],
  }),
  fac('guildhall', 'Guildhall', 'DMG', 17, 'Vast', 1, ['expertise'], {
    desc: 'Meeting hall of a guild of roughly fifty members, of which you are guild master.',
    config: [{ k: 'guild', label: 'Guild', count: 1, choices: ["Adventurers' Guild", "Bakers' Guild", "Brewers' Guild", "Masons' Guild", "Shipbuilders' Guild", "Thieves' Guild", 'Custom guild'] }],
    options: [opt('Recruit', 'Guild Assignment', "Adventurers: slay/capture a CR 2 or lower Beast within 50 miles (1d6+1 days). Bakers: cater an event for 500 GP or a favor. Brewers: fifty barrels of ale (10 GP each) in 7 days. Masons: free defensive walls at 1 day per square. Shipbuilders: build a vehicle at full cost, 1 day per 1,000 GP. Thieves: steal a nonmagical object within 50 miles (1d6+1 days).", { fx: 'item', ask: [what('Assignment'), askDays('Days (see guild)'), askCost('Cost (GP), if any')] })],
  }),
  fac('laboratory', 'Laboratory', 'DMG', 9, 'Roomy', 1, [], {
    desc: 'Alchemical supplies and workspaces.',
    options: [
      opt('Craft', "Alchemist's Supplies", "The hireling crafts anything that can be made with Alchemist's Supplies. Enter time and cost from the crafting rules.", { fx: 'item', ask: [what('Item'), askDays(), askCost()] }),
      opt('Craft', 'Poison', "One application of Burnt Othur Fumes, Essence of Ether, or Torpor. You pay half the poison's cost.", { fx: 'item', ask: [what('Poison', ['Burnt Othur Fumes', 'Essence of Ether', 'Torpor']), askCost('Half the poison cost (GP)')] }),
    ],
  }),
  fac('library', 'Library', 'DMG', 5, 'Roomy', 1, [], {
    desc: 'A collection of books with desks and reading chairs.',
    options: [opt('Research', 'Topical Lore', 'The hireling uncovers up to three accurate, previously unknown facts about a legend, event, place, person, creature type or famous object (DM decides).', { ask: [what('Topic')] })],
  }),
  fac('meditation-chamber', 'Meditation Chamber', 'DMG', 13, 'Cramped', 1, [], {
    desc: 'A relaxing space to align mind, body and spirit.',
    passives: [{ name: 'Fortify Self', text: 'Meditate here for 7 days without leaving the Bastion: gain Advantage on two randomly chosen kinds of saving throw (roll 1d6 twice: Str, Dex, Con, Int, Wis, Cha) for 7 days.' }],
    options: [opt('Empower', 'Inner Peace', 'The next time you roll for a Bastion event, roll twice and choose either result.', { days: 0, fx: 'innerPeace' })],
  }),
  fac('menagerie', 'Menagerie', 'DMG', 13, 'Vast', 2, [], {
    capacity: 4, occupantKind: 'creature',
    desc: 'Enclosures for up to four Large creatures (four Small/Medium count as one Large). Creatures count as Bastion Defenders unless you choose otherwise.',
    options: [opt('Recruit', 'Creature', 'The hirelings acquire a creature. With DM consent other Beasts/Monstrosities cost by CR: 0–1/8 50 GP, 1/4 250, 1/2 500, 1 1,000, 2 2,000, 3 3,500.', {
      fx: 'occupant',
      pick: [['Ape', 'Medium', 500], ['Black Bear', 'Medium', 500], ['Brown Bear', 'Large', 1000], ['Constrictor Snake', 'Large', 250], ['Crocodile', 'Large', 500], ['Dire Wolf', 'Large', 1000], ['Giant Vulture', 'Large', 1000], ['Hyena', 'Medium', 50], ['Jackal', 'Small', 50], ['Lion', 'Large', 1000], ['Owlbear', 'Large', 3500], ['Panther', 'Medium', 250], ['Tiger', 'Large', 1000]].map(([name, size, cost]) => ({ name, size, cost })),
      pickCustom: true,
    })],
  }),
  fac('observatory', 'Observatory', 'DMG', 13, 'Roomy', 1, ['anyfocus'], {
    desc: 'A telescope atop your Bastion aimed at the night sky.',
    passives: [charm('Observatory Charm', 'Contact Other Plane', 'your Observatory')],
    options: [opt('Empower', 'Eldritch Discovery', 'Seven nights of stargazing, then roll a die: on an odd result you or a creature you choose gains a Charm of Darkvision, Heroism, or Vitality.', { fx: 'parity', win: 'odd', success: 'An unknown power bestows a Charm of Darkvision, Heroism, or Vitality (your choice of recipient).', fail: 'Nothing is gained.' })],
  }),
  fac('pub', 'Pub', 'DMG', 13, 'Roomy', 1, [], {
    desc: 'A bar, coffee shop or tea room whose bartender runs a network of spies.',
    config: [{ k: 'specials', label: 'On tap', count: 1, vastCount: 2, choices: ["Bigby's Burden (Enlarge, 24 h)", 'Kiss of the Spider Queen (Spider Climb, 24 h)', 'Moonlight Serenade (Darkvision 60 ft., 24 h)', 'Positive Reinforcement (Necrotic Resistance, 24 h)', 'Sterner Stuff (auto-save vs. Frightened, 24 h)'] }],
    passives: [{ name: 'Pub Special', text: 'One magical beverage on tap; you can switch it at the start of a Bastion turn. A pint loses its magic 24 hours after pouring.' }],
    options: [opt('Research', 'Information Gathering', 'For 7 days your spies know important events within 10 miles and can locate a creature familiar to you within 50 miles (and where it has been for 7 days), unless magically hidden.', { ask: [what('Target or question')] })],
    enlarge: VAST('Two beverages on tap. Gains three hirelings (servers).', { hirelings: 3 }),
  }),
  fac('reliquary', 'Reliquary', 'DMG', 13, 'Cramped', 1, ['divine'], {
    desc: 'A vault of sacred objects.',
    passives: [charm('Reliquary Charm', 'Greater Restoration (no Material components)')],
    options: [opt('Harvest', 'Talisman', 'A talisman that replaces one spell\'s Material components costing 1,000 GP or less, without being consumed. Must be re-prepared here with another Harvest order after use.', { fx: 'item', yield: 'Reliquary talisman' })],
  }),
  fac('sacristy', 'Sacristy', 'DMG', 9, 'Roomy', 1, ['divine'], {
    desc: 'A preparation and storage room for sacred items and vestments.',
    passives: [{ name: 'Spell Refreshment', text: 'After a full Short Rest in your Bastion, regain one spell slot of level 5 or lower. Once per Long Rest.' }],
    options: [
      opt('Craft', 'Holy Water', 'One flask of Holy Water. Each 100 GP spent (max 500) adds 1d8 damage.', { fx: 'item', yield: 'Flask of Holy Water', ask: [askCost('Extra GP for potency (0–500)')] }),
      magicItem('Craft', 'Relics'),
    ],
  }),
  fac('sanctuary', 'Sanctuary', 'DMG', 5, 'Roomy', 1, ['divine'], {
    desc: 'Icons of your faith and a quiet place of worship.',
    passives: [charm('Sanctuary Charm', 'Healing Word')],
    options: [opt('Craft', 'Sacred Focus', 'The hireling crafts a Druidic Focus (wooden staff) or Holy Symbol.', { fx: 'item', ask: [what('Focus', ['Holy Symbol', 'Druidic Focus (wooden staff)'])] })],
  }),
  fac('sanctum', 'Sanctum', 'DMG', 17, 'Roomy', 4, ['divine'], {
    desc: 'A place of solace and healing.',
    passives: [charm('Sanctum Charm', 'Heal'), { name: 'Sanctum Recall', text: 'You always have Word of Recall prepared and can target your Sanctum; one arriving creature gains the benefit of Heal.' }],
    options: [opt('Empower', 'Fortifying Rites', 'For 7 days a beneficiary you name gains Temporary Hit Points equal to your level after each Long Rest.', { days: 0, fx: 'buff', buff: 'Fortifying Rites: temp HP = your level after each Long Rest', buffDays: 7, ask: [what('Beneficiary')] })],
  }),
  fac('scriptorium', 'Scriptorium', 'DMG', 9, 'Roomy', 1, [], {
    desc: 'Desks and writing supplies.',
    options: [
      opt('Craft', 'Book Replica', 'Copy a nonmagical book. Requires a blank book.', { fx: 'item', ask: [what('Book copied')] }),
      opt('Craft', 'Spell Scroll', 'Scribe a Spell Scroll of one Cleric or Wizard spell of level 3 or lower. Enter the time and cost from the scroll-scribing rules.', { fx: 'item', ask: [what('Spell'), askDays(), askCost()] }),
      opt('Craft', 'Paperwork', 'Up to fifty copies of a broadsheet or pamphlet at 1 GP per copy, distributed within 50 miles if you wish.', { fx: 'item', ask: [what('Document'), askCost('Copies (1 GP each, max 50)')] }),
    ],
  }),
  fac('smithy', 'Smithy', 'DMG', 5, 'Roomy', 2, [], {
    desc: 'A forge, anvil and tools for weapons, armor and gear.',
    options: [
      opt('Craft', "Smith's Tools", "The hirelings craft anything that can be made with Smith's Tools. Enter time and cost from the crafting rules.", { fx: 'item', ask: [what('Item'), askDays(), askCost()] }),
      magicItem('Craft', 'Armaments'),
    ],
  }),
  fac('stable', 'Stable', 'DMG', 9, 'Roomy', 1, [], {
    multiple: true, capacity: 3, capacityVast: 6, occupantKind: 'animal',
    desc: 'Comes with one Riding Horse or Camel and two Ponies or Mules. Houses three Large animals (two Medium count as one Large). After 14 days here, Animal Handling checks with a mount have Advantage.',
    options: [
      opt('Trade', 'Buy Animals', 'The hireling buys mounts at normal cost and keeps them in the Stable.', { fx: 'item', ask: [what('Animals bought'), askCost('Total price (GP)')] }),
      opt('Trade', 'Sell Animals', 'Buyers pay 20% over standard price (50% at level 13, 100% at level 17).', { fx: 'sell', profit: [[17, 100], [13, 50], [0, 20]], ask: [what('Animals sold'), { k: 'value', label: 'Standard price (GP)', num: true }] }),
    ],
    enlarge: VAST('Houses six Large animals.'),
  }),
  fac('storehouse', 'Storehouse', 'DMG', 5, 'Roomy', 1, [], {
    desc: 'A cool, dark space for trade goods.',
    options: [
      opt('Trade', 'Buy Goods', 'Procure nonmagical items worth up to 500 GP (2,000 at level 9, 5,000 at level 13).', { fx: 'item', ask: [what('Goods bought'), askCost('Total price (GP)')] }),
      opt('Trade', 'Sell Goods', 'Buyers pay 10% over standard price (20% at level 9, 50% at 13, 100% at 17).', { fx: 'sell', profit: [[17, 100], [13, 50], [9, 20], [0, 10]], ask: [what('Goods sold'), { k: 'value', label: 'Standard price (GP)', num: true }] }),
    ],
  }),
  fac('teleportation-circle', 'Teleportation Circle', 'DMG', 9, 'Roomy', 1, [], {
    desc: 'A permanent teleportation circle inscribed on the floor.',
    options: [opt('Recruit', 'Spellcaster', 'Invite a Friendly NPC spellcaster; roll a die, even means they accept. They stay 14 days or until they cast one Wizard spell of level 4 or lower (level 8 if you are 17+) for you; you pay costly components.', { days: 0, fx: 'parity', win: 'even', success: 'A Friendly spellcaster arrives and will cast one Wizard spell for you within 14 days.', fail: 'The invitation is declined.', buffOnSuccess: 'Visiting spellcaster (one Wizard spell on request)', buffDays: 14 })],
  }),
  fac('theater', 'Theater', 'DMG', 9, 'Vast', 4, [], {
    desc: 'A stage, backstage and seating for a small audience.',
    options: [opt('Empower', 'Theatrical Event', '14 days of rehearsal, then at least 7 days of performances. Contributors (writer, director, performer) each make a DC 15 Performance check; if more succeed than fail, each gains a Theater die (d6; d8 at level 13; d10 at level 17) to add to one D20 Test.', { days: 14, done: 'Rehearsals are over. Each contributor makes a DC 15 Charisma (Performance) check; if more succeed than fail, each gains a Theater die.', ask: [what('Production')] })],
  }),
  fac('training-area', 'Training Area', 'DMG', 9, 'Vast', 4, [], {
    multiple: true,
    desc: 'A courtyard, gymnasium, hall or gauntlet with one expert trainer. You can swap the trainer each Bastion turn.',
    config: [{ k: 'trainer', label: 'Trainer', count: 1, choices: ['Battle Expert (Reaction: reduce weapon/unarmed damage by 1d4)', 'Skills Expert (proficiency: Acrobatics, Athletics, Performance, Sleight of Hand or Stealth)', 'Tools Expert (proficiency with one tool)', 'Unarmed Combat Expert (+1d4 Bludgeoning on Unarmed Strikes)', 'Weapon Expert (proficiency or mastery with one weapon)'] }],
    options: [opt('Empower', 'Training', 'Anyone who trains 8 hours a day for the 7 days gains the trainer\'s benefit for the following 7 days.', { fx: 'buff', buff: 'Training benefit', buffDays: 7, buffFromConfig: 'trainer' })],
  }),
  fac('trophy-room', 'Trophy Room', 'DMG', 9, 'Roomy', 1, [], {
    desc: 'A collection of mementos, mounted heads and trinkets.',
    options: [
      opt('Research', 'Lore', 'Up to three accurate, previously unknown facts about a legend, creature or famous object (DM decides).', { ask: [what('Topic')] }),
      opt('Research', 'Trinket Trophy', 'Roll a die: on an even result the hireling finds a magic item from the Common Implements table.', { fx: 'parity', win: 'even', success: 'The hireling finds a magic item: roll on the Common Implements table.', fail: 'Nothing useful is found.', itemOnSuccess: 'Common Implement (roll on table)' }),
    ],
  }),
  fac('war-room', 'War Room', 'DMG', 17, 'Vast', 2, ['martial'], {
    lieutenants: true,
    desc: 'Where you plan with loyal Veteran Warrior lieutenants (start with two, up to ten). Each lieutenant housed in the Bastion removes one die from attack loss rolls.',
    options: [
      opt('Recruit', 'Lieutenant', 'Gain one new lieutenant (maximum ten).', { days: 0, fx: 'lieutenant' }),
      opt('Recruit', 'Soldiers', 'Each lieutenant musters 100 Guards (or 20 mounted) in 7 days. Upkeep is 1 GP per day per guard and horse; the army needs you or a lieutenant to lead it.', { done: 'Your army has assembled. Pay 1 GP per day per guard and horse or it disbands.', ask: [what('Army (who leads, how many)')] }),
    ],
  }),
  fac('workshop', 'Workshop', 'DMG', 5, 'Roomy', 3, [], {
    desc: 'A creative space equipped with six kinds of Artisan\'s Tools.',
    config: [{ k: 'tools', label: "Artisan's Tools", count: 6, vastCount: 9, choices: ["Carpenter's Tools", "Cobbler's Tools", "Glassblower's Tools", "Jeweler's Tools", "Leatherworker's Tools", "Mason's Tools", "Painter's Tools", "Potter's Tools", "Tinker's Tools", "Weaver's Tools", "Woodcarver's Tools"] }],
    passives: [{ name: 'Source of Inspiration', text: 'After a full Short Rest in your Workshop, gain Heroic Inspiration. Once per Long Rest.' }],
    options: [
      opt('Craft', 'Adventuring Gear', "The hirelings craft anything that can be made with the Workshop's tools. Enter time and cost from the crafting rules.", { fx: 'item', ask: [what('Item'), askDays(), askCost()] }),
      magicItem('Craft', 'Implements'),
    ],
    enlarge: VAST("Gains two hirelings and three more Artisan's Tools.", { hirelings: 2 }),
  }),

  // ---------------- Forgotten Realms ----------------
  fac('amethyst-dragon-den', 'Amethyst Dragon Den', 'FR', 5, 'Vast', 1, ['m:purpledragon'], {
    desc: 'An enclosed chamber with a pool and an underwater entrance, fit for a visiting amethyst dragon.',
    options: [opt('Empower', 'Psionic Defenses', 'Train 8 hours a day for 7 days to gain Resistance to Psychic damage for 7 days.', { fx: 'buff', buff: 'Resistance to Psychic damage', buffDays: 7 })],
  }),
  fac('cult-of-the-dragon-archive', 'Cult of the Dragon Archive', 'FR', 13, 'Roomy', 1, ['m:cultdragon'], {
    desc: 'Extensive records on dragons and related topics.',
    passives: [{ name: 'Reference Books', text: 'Advantage on Nature or Religion Study checks made in your Bastion about Dragons, Tiamat, or the Cult of the Dragon.' }],
    options: [opt('Research', 'Helpful Lore', 'The hireling learns lore as if by Legend Lore and shares it when you next speak.', { ask: [what('Subject')] })],
    enlarge: VAST('Gain two reference books from the Archive list.'),
  }),
  fac('emerald-enclave-grove', 'Emerald Enclave Grove', 'FR', 9, 'Vast', 2, ['m:emerald'], {
    capacity: 2, occupantKind: 'creature',
    desc: 'A haven of trees, grass and water housing one Huge or two Large creatures (four Small/Medium or eight Tiny count as one Large). Residents count as Bastion Defenders unless you choose otherwise.',
    options: [opt('Recruit', 'Creature of Nature', 'Invite a creature; roll a die, even means it accepts and moves in after 7 days.', {
      fx: 'parity', win: 'even', success: 'The creature accepts and moves into the grove.', fail: 'The creature declines the invitation.', occupantOnSuccess: true,
      pick: [['Awakened Shrub', 'Small'], ['Awakened Tree', 'Huge'], ['Blink Dog', 'Medium'], ['Centaur Trooper', 'Large'], ['Dryad', 'Medium'], ['Myconid Adult', 'Medium'], ['Myconid Sprout', 'Small'], ['Pixie', 'Tiny'], ['Satyr', 'Medium'], ['Sprite', 'Tiny'], ['Treant', 'Large'], ['Unicorn', 'Large']].map(([name, size]) => ({ name, size, cost: 0 })),
    })],
  }),
  fac('harper-hideout', 'Harper Hideout', 'FR', 5, 'Roomy', 1, ['m:harpers'], {
    desc: 'A hidden safe house linked to your Bastion by a tunnel up to a quarter mile long. Relocatable each time you gain a level.',
    passives: [{ name: 'Hideout Defenses', text: 'Always under an Alarm spell. Level 9: magic doorway, anywhere within 100 miles. Level 13: anywhere in Faerûn. Level 17: anywhere in the multiverse.' }],
    options: [opt('Empower', 'Harper Training', 'Roll a die: on an even result a Harper stays 7 days. Anyone training with them 8 hours a day gains proficiency in Deception, Investigation or Performance for 7 days.', { fx: 'parity', win: 'even', success: 'A Friendly Harper stayed for 7 days and trained those who studied with them.', fail: 'No Harper needs the hideout right now.', buffOnSuccess: 'Harper Training: proficiency in Deception, Investigation or Performance', buffDays: 7 })],
  }),
  fac('lords-alliance-noble-residence', "Lords' Alliance Noble Residence", 'FR', 9, 'Vast', 1, ['m:lordsalliance'], {
    desc: 'A luxurious apartment fit for a city ruler, tended by a butler.',
    passives: [{ name: 'Noble Rest', text: 'After a Long Rest in the residence you gain Heroic Inspiration.' }],
    options: [opt('Recruit', 'Visiting Noble', 'Give up the residence for 14 days. Roll a die: on an even result a noble arrives within 7 days, stays 7, and can reveal the whereabouts of a creature familiar to you within 50 miles of their home settlement.', { days: 14, fx: 'parity', win: 'even', success: 'A noble visited and shared gossip from their home settlement.', fail: 'No one accepts your invitation.', ask: [what('Settlement / creature sought')] })],
  }),
  fac('order-of-the-gauntlet-tournament-field', 'Order of the Gauntlet Tournament Field', 'FR', 9, 'Vast', 1, ['m:gauntlet'], {
    attackDiceMinus: 1,
    desc: 'A marked-off field for single combat with room for spectators. Your hireling is a Knight who removes one die from attack loss rolls.',
    options: [opt('Empower', 'Hold Tournament', '7 days for word to spread, 7 more for the tournament. Spend 2,000 GP on prizes; your Renown with the Order of the Gauntlet increases by 1.', { days: 14, cost: 2000, done: 'The tournament concludes. Your Renown with the Order of the Gauntlet increases by 1.' })],
  }),
  fac('red-wizard-necropolis', 'Red Wizard Necropolis', 'FR', 5, 'Roomy', 1, ['m:redwizards', 'anyfocus'], {
    houses: 8,
    desc: 'Crypts sheltering up to eight Undead Bastion Defenders. A destroyed Undead defender returns 14 days later if there is room.',
    options: [opt('Recruit', 'Undead Defenders', 'Up to four Undead Bastion Defenders are created and shelter here.', { days: 0, fx: 'defenders' })],
  }),
  fac('zhentarim-travel-station', 'Zhentarim Travel Station', 'FR', 5, 'Vast', 2, ['m:zhentarim'], {
    desc: 'Temporary stabling for four Large creatures and support for long journeys.',
    passives: [{ name: 'Long-Distance Travel Speed', text: "After a Long Rest in your Bastion, your group's maximum travel pace increases by one step." }],
    options: [opt('Research', 'Reconnaissance', 'After 7 days of scouting, you have Advantage on Survival checks to forage or navigate for one upcoming journey.', { done: 'Reconnaissance complete: Advantage on Wisdom (Survival) checks to forage or navigate during the journey.', ask: [what('Journey')] })],
  }),

  // ---------------- Eberron ----------------
  fac('artificers-forge', "Artificer's Forge", 'EB', 13, 'Roomy', 2, ['artisan'], {
    desc: 'Two magewright hirelings skilled at creating magic items.',
    passives: [{ name: 'Crafting Assistants', text: 'The hirelings can assist when you craft a magic item in your Bastion, reducing the time.' }, { name: 'Charge Refreshment', text: 'A magic item in your Bastion that regains charges regains 1 extra.' }],
    options: [opt('Craft', 'Magic Item', 'The hirelings craft any Common or Uncommon magic item, assisting each other to reduce the time. They have any needed spells prepared.', { fx: 'item', ask: [what('Item'), askDays(), askCost()] })],
  }),
  fac('construct-forge', 'Construct Forge', 'EB', 17, 'Vast', 2, ['artisan'], {
    occupantKind: 'construct',
    desc: 'A forge for building Constructs, which count as Bastion Defenders unless you choose otherwise.',
    options: [opt('Recruit', 'Construct', 'The hirelings build a Construct. (Building a Warforged Titan breaks the Treaty of Korth.)', {
      fx: 'occupant',
      pick: [['Animated Armor', 14, 1000], ['Animated Broom', 7, 250], ['Animated Flying Sword', 7, 250], ['Animated Rug of Smothering', 21, 2000], ['Helmed Horror', 42, 5000], ['Scarecrow', 14, 1000], ['Shield Guardian', 63, 25000], ['Warforged Titan', 250, 200000]].map(([name, days, cost]) => ({ name, days, cost, size: '' })),
    })],
  }),
  fac('dragonmark-outpost', 'Dragonmark Outpost', 'EB', 5, 'Roomy', 1, ['m:dragonmarked'], {
    desc: 'An area set aside for your dragonmarked house, staffed by a house agent. Your Renown with the house increases by 1 when added.',
    passives: [{ name: 'Dragonmark Empowerment', text: 'Requires a Dragonmark feat. After a Long Rest in your Bastion, gain one extra level 2 spell slot usable only for Dragonmark feat spells.' }],
    options: [opt('Empower', 'House Favor', "Call in a house favor your Renown allows without it counting against your total. Usable again only after your Renown with the house increases.", { days: 0, ask: [what('Favor')] })],
  }),
  fac('inquisitives-agency', "Inquisitive's Agency", 'EB', 13, 'Roomy', 1, [], {
    desc: 'An office of an inquisitive agency with a well-connected secretary.',
    options: [opt('Research', 'Information Gathering', "Learn a named individual's activities for the previous and next 7 days within 10 miles: lodging, spending, meetings, and where they showed papers. A mobile Bastion needs 7 days to set up a network after arriving.", { ask: [what('Individual')] })],
  }),
  fac('kundarak-vault', 'Kundarak Vault', 'EB', 9, 'Cramped', 1, ['m:kundarak'], {
    desc: 'An extradimensional vault only you and your hirelings can open; you alone can reach its contents from any Kundarak bank.',
    options: [
      opt('Trade', 'Buy Goods', 'Procure nonmagical items worth up to 2,000 GP (5,000 at level 13).', { fx: 'item', ask: [what('Goods bought'), askCost('Total price (GP)')] }),
      opt('Trade', 'Sell Goods', 'Buyers pay 20% over standard price (50% at level 13, 100% at 17).', { fx: 'sell', profit: [[17, 100], [13, 50], [0, 20]], ask: [what('Goods sold'), { k: 'value', label: 'Standard price (GP)', num: true }] }),
    ],
  }),
  fac('lyrandar-helm', 'Lyrandar Helm', 'EB', 13, 'Cramped', 1, ['m:lyrandar'], {
    desc: 'Lets a mobile Bastion built in an elemental airship or galleon travel, piloted by a Lyrandar heir.',
    options: [opt('Empower', 'Travel', "Travel at the vehicle's speed, 8 hours a day, for the turn. Also triggers a Bastion event roll as if you had issued Maintain.", { fx: 'travel', ask: [what('Destination')] })],
  }),
  fac('manifest-zone', 'Manifest Zone', 'EB', 13, 'Vast', 1, ['anyfocus'], {
    desc: "The Bastion is infused with the energy of one of Eberron's planes.",
    config: [{ k: 'plane', label: 'Linked plane', count: 1, choices: ['Daanvi (end Blinded, Deafened, Paralyzed or Poisoned)', 'Dolurrh (upcast Necromancy by 1)', 'Fernia (upcast Fire spells by 1)', 'Irian (upcast healing/Radiant spells by 1)', 'Lamannia (upcast Beast/Elemental/Fey summons by 1)', 'Mabar (upcast Undead animation/summons by 1)', 'Risia (upcast Cold spells by 1)', 'Shavarath (+10 damage on a Critical Hit)', 'Syrania (Fly Speed for 1 minute)', 'Thelanis (Disadvantage on a save vs. Enchantment/Illusion)', 'Xoriat (roll a Wild Magic Surge)'] }],
    options: [opt('Empower', 'Manifest Charm', 'After 7 days of rites you gain a Manifest Charm that lasts until used; its effect depends on the linked plane.', { fx: 'item', yield: 'Manifest Charm', yieldFromConfig: 'plane' })],
  }),
  fac('museum', 'Museum', 'EB', 13, 'Roomy', 1, [], {
    desc: 'Catalogued relics and treasures from your expeditions.',
    config: [{ k: 'treasures', label: 'Treasure origin', count: 1, vastCount: 2, choices: ["Argonnessen (Draconic; Dragon's Breath)", 'Ashtakala (Abyssal & Infernal; Ray of Sickness)', 'Dhakaan (Goblin; Staggering Smite)', 'Khyber (Darkvision 120 ft.; Truesight 60 ft.)', "Xen'drik (Giant; Strength 25 for 1 hour)"] }],
    passives: [{ name: 'Secrets of the Past', text: 'Study a treasure for 7 days then finish a Long Rest in your Bastion to gain its Charm for 7 days or until used.' }],
    options: [opt('Research', 'Specialized Lore', 'The hireling answers a question of ancient history as if by Legend Lore.', { ask: [what('Question')] })],
    enlarge: VAST('Two treasures of different origins. Gains two hirelings.', { hirelings: 2 }),
  }),
  fac('navigators-helm', "Navigator's Helm", 'EB', 9, 'Cramped', 1, [], {
    desc: 'Lets a mobile Bastion built in a mundane waterborne vehicle travel.',
    options: [opt('Empower', 'Travel', "Sail at the vehicle's speed, 8 hours a day, for the turn. Also triggers a Bastion event roll as if you had issued Maintain.", { fx: 'travel', ask: [what('Destination')] })],
  }),
  fac('orien-helm', 'Orien Helm', 'EB', 9, 'Cramped', 1, ['m:orien'], {
    desc: 'Lets a mobile Bastion built in a Lightning Rail cart travel, piloted by an Orien heir.',
    options: [opt('Empower', 'Travel', 'Travel 30 miles per hour, 8 hours a day, along conductor stones for the turn. Also triggers a Bastion event roll as if you had issued Maintain.', { fx: 'travel', ask: [what('Destination')] })],
  }),

  // ---------------- Ravenloft ----------------
  fac('ancient-altar', 'Ancient Altar', 'RL', 9, 'Cramped', 1, [], {
    desc: 'A solemn chamber for offerings to mysterious forces.',
    passives: [{ name: 'Blasphemous Charm', text: 'After a Long Rest at the altar, gain a Charm (7 days or until used) to cast Hunger of Hadar as a Magic action without Material components.' }],
    options: [opt('Empower', 'Purge Haunted Facility', 'A 7-day ritual (you must stay in the Bastion) ending in a sacrifice: 1,000 GP, or fresh corpses (one Large or four Medium), which also triggers a roll on the Hauntings table. One Haunted facility in this or a connected Bastion is cleansed.', { fx: 'purge', ask: [{ k: 'what', label: 'Sacrifice', choices: ['1,000 GP', 'Blood sacrifice'] }] })],
  }),
  fac('cabinet-of-curiosities', 'Cabinet of Curiosities', 'RL', 9, 'Cramped', 1, [], {
    desc: 'A small salon for peculiar objects and oddities.',
    options: [opt('Trade', 'Acquire Curios', 'Invest gold; after 28 days the hireling returns with magic items of the matching rarity. Quantity and curse chance depend on how many Haunted facilities you have then.', {
      days: 28, fx: 'curios',
      pick: [['Common', 150], ['Uncommon', 600], ['Rare', 6000], ['Very Rare', 60000]].map(([name, cost]) => ({ name, cost })),
    })],
  }),
  fac('infirmary', 'Infirmary', 'RL', 9, 'Roomy', 2, ['medicine'], {
    triage: true,
    desc: 'Emergency healing and continual care for the Bastion.',
    passives: [{ name: 'Triage', text: 'When rolling for lost Bastion Defenders in an attack, reroll a number of dice equal to this facility\'s hirelings.' }],
    options: [
      opt('Craft', 'Antitoxin', 'Two vials of Antitoxin (four if Vast). Spend 50 GP per vial to enhance it so it ends the Poisoned condition (lasts 28 days).', { fx: 'item', yield: 'Antitoxin ×2', ask: [askCost('GP spent on enhancement')] }),
      opt('Craft', 'Enhanced Potion of Healing', 'Upgrade up to two Potions of Healing you provide to greater (at level 13, greater to superior). Four if Vast.', { days: 14, fx: 'item', ask: [what('Potions enhanced')] }),
    ],
    enlarge: VAST('Gains two hirelings; enhance up to four Antitoxins or potions at a time.', { hirelings: 2 }),
  }),
  fac('lightning-generator', 'Lightning Generator', 'RL', 13, 'Roomy', 1, [], {
    desc: 'Turns atmospheric electricity to useful ends.',
    passives: [
      { name: 'Charm of Electromancy', text: 'After a Long Rest here you take 8d6 Lightning damage and gain a 7-day Charm with 3 charges; spend one to cast Telekinesis.' },
      { name: 'Revivification', text: 'Raise Dead and Resurrection cast here cost 1,000 GP less in Material components.' },
    ],
    options: [opt('Empower', 'Lightning Life', 'The hireling casts Animate Objects on one Large or Huge object in the Bastion; lasts 7 days without Concentration.', { days: 0, fx: 'buff', buff: 'Lightning Life: an animated Large or Huge object', buffDays: 7, ask: [what('Object')] })],
  }),
  fac('liminal-space', 'Liminal Space', 'RL', 17, 'Vast', 1, [], {
    alwaysHaunted: true, noMap: true, capacity: 3, occupantKind: 'entity', attackDicePerOccupant: true,
    desc: 'A connection to an unfathomable demiplane, entered through closets and shadows. Takes up no space. Always Haunted. Up to three entities; each removes one die from attack loss rolls.',
    passives: [{ name: 'Dark Bargains', text: 'Wander inside for 7 days without leaving the Bastion to gain a Dark Gift feat (replacing any earlier one from here).' }],
    options: [opt('Recruit', 'Stranger', 'A 7-day ritual costing 1,000 GP. Roll a die: even, an entity takes up residence; odd, it kills the hireling and the facility is unusable until your next Bastion turn.', { cost: 1000, fx: 'liminal' })],
  }),
  fac('rookery', 'Rookery', 'RL', 5, 'Cramped', 1, [], {
    desc: 'Ravens equal to your level roost here, watching every visitor.',
    passives: [{ name: 'Messenger Ravens', text: 'After a Long Rest in your Bastion, send a raven with a 25-word message to a creature on the same plane (or a Mist-linked demiplane). It returns after 7 days, with a reply if one is given.' }],
    options: [opt('Craft', 'Mist Talisman', 'After 21 days the hireling produces a Mist talisman linked to a Domain of Dread you have visited or heard of first-hand.', { days: 21, fx: 'item', ask: [what('Domain of Dread')] })],
  }),
  fac('seance-parlor', 'Séance Parlor', 'RL', 5, 'Cramped', 1, [], {
    desc: 'The veil between the living and the dead grows thin here.',
    passives: [{ name: 'Speak with Dead', text: 'After a Long Rest here, cast Speak with Dead for free on any dead creature whose name you know, given a piece of its remains or a treasured object.' }],
    options: [opt('Research', 'Fortune Telling', 'Your fortune is read and you gain Heroic Inspiration. Once per Long Rest.', { days: 0, done: 'Your fortune is read: you gain Heroic Inspiration.' })],
  }),
  fac('spirit-vault', 'Spirit Vault', 'RL', 13, 'Roomy', 1, [], {
    alwaysHaunted: true,
    desc: 'A warded vault of haunted portraits and cursed relics. Always Haunted.',
    passives: [{ name: 'Esoteric Knowledge', text: 'After a Long Rest here, gain a Charm of Exorcism (Dispel Evil and Good or Remove Curse) or Charm of Malediction (Hex at level 3 or Bestow Curse) for 7 days or until used.' }],
    options: [opt('Research', 'Ask the Occult', 'After 7 days roll 1d6. On a 1 the work is taxing: 6d6 Psychic damage to you, or the hireling dies and the vault is unusable until your next turn. Otherwise gain answers as if by Contact Other Plane.', { fx: 'spiritVault', ask: [{ k: 'what', label: 'Who researches', choices: ['Hireling', 'You'] }] })],
  }),

  // ---------------- Arcana Unleashed ----------------
  fac('circus-tent', 'Circus Tent', 'AU', 9, 'Vast', 4, ['m:phantasmic'], {
    desc: 'A venue for crowd-pleasing performances, staffed by four Performers.',
    options: [opt('Trade', 'Circus Performance', 'Seven days of shows; your share is 2d6 × 10 GP.', { fx: 'gold', dice: [2, 6, 10] })],
  }),
  fac('entertainment-salon', 'Entertainment Salon', 'AU', 5, 'Roomy', 2, ['m:bejeweled'], {
    openPockets: true,
    desc: 'An elegant salon with reclining couches and a well-stocked bar.',
    passives: [{ name: 'Open Pockets', text: 'When you roll dice for GP paid or gained from a Bastion order or event, roll twice and take either result. (Applied automatically.)' }],
    options: [opt('Research', 'Learn Secrets', 'Learn 1d4 little-known facts about a named creature within 50 miles, and how its power compares to yours.', { fx: 'secrets', ask: [what('Creature')] })],
  }),
  fac('geothermal-vent', 'Geothermal Vent', 'AU', 5, 'Roomy', 1, ['m:crucible'], {
    desc: 'Draws heat from deep below to power simple machines and warm the Bastion.',
    passives: [{ name: 'Hot Water', text: 'Your basic facilities enjoy a constant, adjustable source of heat.' }],
    options: [opt('Empower', 'Withstand Heat', 'Anyone who trains 8 hours a day for 7 days can use a Reaction to reduce Fire damage by 1d4 + their level, for the following 7 days.', { fx: 'buff', buff: 'Heat Tolerant: Reaction to reduce Fire damage by 1d4 + level', buffDays: 7 })],
  }),
  fac('heist-planning-chamber', 'Heist Planning Chamber', 'AU', 9, 'Roomy', 1, ['m:ninthquill'], {
    desc: 'A planning table, miniature terrain and tomes on security and spycraft.',
    passives: [{ name: 'Heist Preparations', text: 'Prepare with the model for 8 hours to pick a role (two if Vast) granting Advantage within 1 mile of the building for 7 days: Enforcer (Intimidation), Face (Deception), Lookout (Perception), Medic (Medicine), Sneak (Stealth), Thief (Sleight of Hand).' }],
    options: [opt('Research', 'Reconnaissance', 'Spies scout a building within 50 miles (500 if Vast) and build a model: public areas accurate, private areas general.', { done: 'A model of the building is ready on the planning table.', ask: [what('Building')] })],
    enlarge: VAST('Reconnaissance range becomes 500 miles; preparers choose two roles.'),
  }),
  fac('lighthouse', 'Lighthouse', 'AU', 9, 'Roomy', 1, ['m:seers'], {
    desc: 'A tall lighthouse whose light is visible far off even in poor weather.',
    passives: [{ name: 'Vision Charm', text: 'After a Long Rest in the Lighthouse you gain the Charm of Darkvision.' }],
    options: [opt('Harvest', 'Illuminate Treasure', 'After 7 days of watching, pay 100 GP for salvagers who return with treasure worth 1d4 × 100 GP.', { cost: 100, fx: 'gold', dice: [1, 4, 100] })],
  }),
  fac('morgue', 'Morgue', 'AU', 5, 'Cramped', 1, ['m:covenant'], {
    desc: 'Stores up to four Small or Medium corpses under Gentle Repose while the hireling is present.',
    options: [opt('Research', 'Cadaver Insights', 'The hireling learns each corpse\'s cause of death and can answer one question per corpse as if by Speak with Dead.', { ask: [what('Questions')] })],
    enlarge: { to: 'Roomy', cost: 2000, text: 'Stores up to twelve Small or Medium corpses and one Large corpse.' },
  }),
  fac('planar-gateway', 'Planar Gateway', 'AU', 17, 'Roomy', 1, ['m:horizon', ['arcane', 'divine']], {
    desc: 'An inscribed stone archway that can connect to other planes.',
    options: [opt('Empower', 'Open Gate', 'After 7 days of tuning the gate opens for 1 minute. With a diamond worth 5,000+ GP (consumed) you choose the destination; otherwise it is random.', { fx: 'gate', ask: [{ k: 'what', label: 'Destination', choices: ['Random (no diamond)', 'Chosen (5,000 GP diamond)'] }] })],
  }),
  fac('soup-kitchen', 'Soup Kitchen', 'AU', 5, 'Roomy', 1, ['m:sheltering'], {
    desc: 'Prepares large quantities of food for hungry people.',
    passives: [{ name: 'Traveling Snacks', text: 'After a Long Rest in your Bastion, gain a Charm (7 days or until used) to cast Goodberry once without a spell slot.' }],
    options: [opt('Recruit', 'Kitchen Operation', 'Run the kitchen for 7 days (50 GP of ingredients). If the next Bastion event would cost you a Bastion Defender or hireling, a volunteer takes their place.', { cost: 50, fx: 'soup' })],
  }),
  fac('transmutation-vat', 'Transmutation Vat', 'AU', 5, 'Cramped', 1, ['m:cosmicdawn'], {
    desc: 'A vat simmering with transformative potential.',
    options: [opt('Harvest', 'Fluid Transmutation', "Destroy a Common or Uncommon potion to produce Alchemist's Fire, Antitoxin, Basic Poison, or a Common or Uncommon potion of your choice (two swaps if Roomy).", { fx: 'item', ask: [what('Potion given → substance produced')] })],
    enlarge: { to: 'Roomy', cost: 2000, text: 'Transmute two potions per Harvest order.' },
  }),
];

export const FACILITY_BY_KEY = Object.fromEntries(FACILITIES.map((f) => [f.key, f]));

// --- tables -----------------------------------------------------------------
export const EVENTS = [
  [50, 'allWell', 'All Is Well'],
  [55, 'attack', 'Attack'],
  [58, 'criminal', 'Criminal Hireling'],
  [63, 'opportunity', 'Extraordinary Opportunity'],
  [72, 'visitors', 'Friendly Visitors'],
  [76, 'guest', 'Guest'],
  [79, 'lostHirelings', 'Lost Hirelings'],
  [83, 'magical', 'Magical Discovery'],
  [91, 'refugees', 'Refugees'],
  [98, 'aid', 'Request for Aid'],
  [100, 'treasure', 'Treasure'],
];

export const ALL_WELL = [
  'Accident reports are way down.',
  'The leak in the roof has finally been fixed.',
  'No vermin infestations to report.',
  'You-Know-Who lost their spectacles again.',
  'One of the hirelings adopted a stray dog.',
  'A lovely letter arrived from a friend.',
  "Some joker keeps putting rotten eggs in people's boots.",
  'Someone thought they saw a ghost.',
];

export const TREASURE = [
  [40, 'an art object: roll on the 25 GP Art Objects table'],
  [63, 'an art object: roll on the 250 GP Art Objects table'],
  [73, 'an art object: roll on the 750 GP Art Objects table'],
  [75, 'an art object: roll on the 2,500 GP Art Objects table'],
  [90, 'a Common magic item: roll on a Common table of your choice (Arcana, Armaments, Implements, or Relics)'],
  [98, 'an Uncommon magic item: roll on an Uncommon table of your choice'],
  [100, 'a Rare magic item: roll on a Rare table of your choice'],
];

export const GAMBLING = [[50, 1], [85, 2], [95, 4], [100, 10]]; // N d6 × 10 GP

export const HAUNTINGS = [
  [7, 'cursedHireling', 'Cursed Hireling'],
  [15, 'freeSpirit', 'Free-Roaming Spirit'],
  [22, 'friendlyGhost', 'Friendly Ghost'],
  [29, 'hiddenRoom', 'Hidden Room'],
  [38, 'lightningStorm', 'Lightning Storm'],
  [47, 'livingDead', 'Living Dead'],
  [55, 'mistWanderers', 'Mist Wanderers'],
  [63, 'priest', 'Mysterious Priest'],
  [71, 'illLuck', 'Ill Luck'],
  [79, 'poltergeist', 'Poltergeist'],
  [86, 'spatialWarp', 'Spatial Warp'],
  [93, 'spectralVision', 'Spectral Vision'],
  [100, 'vistani', 'Vistani Visitors'],
];

export const PLANES = ['Abyss', 'Acheron', 'Arborea', 'Arcadia', 'Astral Plane', 'Beastlands', 'Bytopia', 'Carceri', 'Elemental Plane of Air', 'Elemental Plane of Earth', 'Elemental Plane of Fire', 'Elemental Plane of Water', 'Elysium', 'Ethereal Plane', 'Feywild', 'Gehenna', 'Hades', 'Limbo', 'Mechanus', 'Mount Celestia', 'Nine Hells', 'Outlands', 'Pandemonium', 'Shadowfell', 'Ysgard'];

export const CURIO_COUNT = [[0, null, 0], [2, 2, 10], [5, 3, 20], [6, 4, 25]]; // [maxHaunted, die for count (null = 1), curse %]

export const GARDEN_YIELD = {
  Decorative: 'Ten floral bouquets (5 GP each), ten vials of Perfume, or ten Candles',
  Food: '100 days of Rations',
  Herb: "Herbs for ten Healer's Kits or one Potion of Healing",
  Poison: 'Plants for two vials of Antitoxin or one vial of Basic Poison',
};
