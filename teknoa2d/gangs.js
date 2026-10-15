/* Teknoa 2D: Nova City's gangs, from the vault (NovaCity_Gangs, v0.1).
   One block per gang. To add a gang, copy a block and change it; to drop
   one, delete its block. Nothing else needs touching: who jumps you, where,
   how hard and what they say all read from here (combat.js, foes.js).

     code       the vault's gang code
     name       what the street calls them;  one: a single member (demonym)
     ideology, members, crimes   the vault's words, for the wiki and dialogue
     colour     their signifier, worn on the body (bandana, accents, paint)
     turf       districts they hold (world.js DISTRICTS ids)
     threat     low | medium | high: how strong their members come
     allies, rivals   other gangs' ids (and 'hex')
     targets    origins they go after on sight: 'all', or a list. an origin
                they can't see (a covered barcode) counts as human
     never      origins they leave alone, whatever else is true
     robs       on a win they take your joules and everything not in a safe slot
     violent    false: they never start a fight (they work the system instead)
     calm       conditions that keep them off you, any one is enough (engine.js
                test: flag:x, met:x, origin:x, aff:hex>=3 ... ! negates)
     angry      conditions that set them on you even when calm says otherwise
   PLACEHOLDER: targets, never, calm and angry are first guesses for Oms to
   adjust; the rest is the vault's. */
(function (root) {
  'use strict';
  var HUMAN = ['sapien', 'novan', 'product'];
  var GANGS = {
    intergang: {
      code: 'ITG', name: 'Intergang', one: 'gangoon',
      ideology: 'all for us or none for all.', members: 'earth\'s organized crime, united.', crimes: 'human trafficking. the list goes on.',
      colour: '#7a1f2b', mark: 'a discreet, hidden demon symbol',
      turf: ['worldwood', 'majinryu', 'redrum'], threat: 'high',
      allies: ['troop'], rivals: ['electricdead', 'buzzeddragons'],
      targets: 'all', robs: true, violent: true
    },
    electricdead: {
      code: 'EDS', name: 'Electric Dead', one: 'electro',
      ideology: 'metal over flesh.', members: 'heavily tech-enhanced bodies.', crimes: 'assault. forced tech implants.',
      colour: '#ffe14a', mark: 'a yellow bandana',
      turf: ['majinryu', 'redrum'], threat: 'medium',
      allies: ['troop'], rivals: ['intergang', 'buzzeddragons'],
      /* flesh is the problem. an android is already what they want to be */
      targets: 'all', never: ['ai'], robs: true, violent: true
    },
    buzzeddragons: {
      code: 'BDS', name: 'Buzzed Dragons', one: 'dragon',
      ideology: 'evolve with nature.', members: 'biologically enhanced bodies.', crimes: 'drug and weapons trafficking.',
      colour: '#ff8a2a', mark: 'an orange bandana',
      turf: ['majinryu', 'redrum'], threat: 'medium',
      allies: ['troop'], rivals: ['intergang', 'electricdead'],
      targets: 'all', robs: true, violent: true
    },
    troop: {
      code: 'TTP', name: 'The Troop', one: 'trooper',
      ideology: 'money over everything.', members: 'great ape crime families.', crimes: 'they exploit the system without breaking a law.',
      colour: '#2a2a33', mark: 'designer suits, discreetly',
      turf: ['naturia'], threat: 'medium',
      allies: ['intergang'], rivals: [],
      targets: [], robs: false, violent: false
    },
    foojeez: {
      code: 'FJZ', name: 'Foojeez', one: 'foojee',
      ideology: 'survive by any means necessary.', members: 'refugees stuck in poverty.', crimes: 'theft, hacking, banking fraud.',
      colour: '#5fbf6a', mark: 'green accents',
      turf: ['yucayeque'], threat: 'low',
      allies: ['revengers'], rivals: ['intergang'],
      targets: 'all', robs: true, violent: true
    },
    revengers: {
      code: 'RVG', name: 'Revengers', one: 'revenger',
      ideology: 'never forget the trials of earth.', members: 'extremist apes bent on revenge.', crimes: 'terrorism, homicide, robbery.',
      colour: '#c4373a', mark: 'red war paint',
      turf: ['naturia', 'worldwood', 'redrum'], threat: 'high',
      allies: ['foojeez'], rivals: [],
      /* their quarrel is with humans */
      targets: HUMAN, robs: true, violent: true
    },
    nullifiers: {
      code: 'NFS', name: 'Nullifiers', one: 'nullifier', aka: 'the quiet oath, the oathless',
      ideology: 'honor among the wicked.', members: 'decentralized vagabond units.', crimes: 'crooks and mercenaries for hire. they keep redrum\'s criminals in line.',
      colour: '#9f6cff', mark: 'purple accents',
      turf: ['redrum'], threat: 'low',
      allies: ['hex'], rivals: [],
      /* hex's people: they leave you be until you've crossed her */
      targets: 'all', calm: ['!flag:hex-closed'], robs: true, violent: true
    }
  };
  root.MFGangs = GANGS;
})(typeof window !== 'undefined' ? window : globalThis);
