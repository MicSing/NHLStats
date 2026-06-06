export interface AchievementDef {
    id:         string
    icon:       string
    nameKey:    string
    descKey:    string
    valueLabel: string
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
    { id: 'sniper',               icon: '?', nameKey: 'achievements.sniper.name',               descKey: 'achievements.sniper.desc',               valueLabel: 'goals' },
    { id: 'domination',           icon: '?', nameKey: 'achievements.domination.name',           descKey: 'achievements.domination.desc',           valueLabel: 'goals' },
    { id: 'shorty',               icon: '?', nameKey: 'achievements.shorty.name',               descKey: 'achievements.shorty.desc',               valueLabel: 'SH goals' },
    { id: 'god_mode',             icon: '?', nameKey: 'achievements.godMode.name',              descKey: 'achievements.godMode.desc',              valueLabel: 'fwd goals' },
    { id: 'blue_line_snipers',    icon: '?', nameKey: 'achievements.blueLineSnipers.name',      descKey: 'achievements.blueLineSnipers.desc',      valueLabel: 'def goals' },
    { id: 'massive_attack',       icon: '?', nameKey: 'achievements.massiveAttack.name',        descKey: 'achievements.massiveAttack.desc',        valueLabel: 'fwd goals' },
    { id: 'offensive_defenseman', icon: '?', nameKey: 'achievements.offensiveDefenseman.name',  descKey: 'achievements.offensiveDefenseman.desc',  valueLabel: 'def goals' },
    { id: 'player_lover',         icon: '?', nameKey: 'achievements.playerLover.name',          descKey: 'achievements.playerLover.desc',          valueLabel: 'goals' },
    { id: 'golden_stick',         icon: '?', nameKey: 'achievements.goldenStick.name',          descKey: 'achievements.goldenStick.desc',          valueLabel: 'goals' },
    { id: 'sin_bin_vip',          icon: '?', nameKey: 'achievements.sinBinVip.name',            descKey: 'achievements.sinBinVip.desc',            valueLabel: 'penalties' },
    { id: 'broad_street_bully',   icon: '?', nameKey: 'achievements.broadStreetBully.name',     descKey: 'achievements.broadStreetBully.desc',     valueLabel: 'penalties' },
    { id: 'disciplinary_hearing', icon: '?', nameKey: 'achievements.disciplinaryHearing.name',  descKey: 'achievements.disciplinaryHearing.desc',  valueLabel: 'penalties' },
    { id: 'the_enforcer',         icon: '?', nameKey: 'achievements.theEnforcer.name',          descKey: 'achievements.theEnforcer.desc',          valueLabel: 'penalties' },
    { id: 'goon_squad',           icon: '?', nameKey: 'achievements.goonSquad.name',            descKey: 'achievements.goonSquad.desc',            valueLabel: 'penalties' },
    { id: 'jailbird',             icon: '?', nameKey: 'achievements.jailbird.name',             descKey: 'achievements.jailbird.desc',             valueLabel: 'penalties' },
    { id: 'unlucky',              icon: '?', nameKey: 'achievements.unlucky.name',              descKey: 'achievements.unlucky.desc',              valueLabel: 'minus' },
    { id: 'deep_pockets',         icon: '?', nameKey: 'achievements.deepPockets.name',          descKey: 'achievements.deepPockets.desc',          valueLabel: 'minus' },
    { id: 'vip_sponzor',          icon: '?', nameKey: 'achievements.vipSponzor.name',           descKey: 'achievements.vipSponzor.desc',           valueLabel: 'minus' },
    { id: 'the_atm',              icon: '?', nameKey: 'achievements.theAtm.name',               descKey: 'achievements.theAtm.desc',               valueLabel: 'minus' },
    { id: 'ice_general',          icon: '?', nameKey: 'achievements.iceGeneral.name',           descKey: 'achievements.iceGeneral.desc',           valueLabel: 'plus' },
    { id: 'good_week',            icon: '?', nameKey: 'achievements.goodWeek.name',             descKey: 'achievements.goodWeek.desc',             valueLabel: 'plus' },
    { id: 'happy_season',         icon: '?', nameKey: 'achievements.happySeason.name',          descKey: 'achievements.happySeason.desc',          valueLabel: 'plus' },
    { id: 'king_of_the_rnk',      icon: '?', nameKey: 'achievements.kingOfTheRnk.name',         descKey: 'achievements.kingOfTheRnk.desc',         valueLabel: 'plus' },
    { id: 'oracle',               icon: '?', nameKey: 'achievements.oracle.name',               descKey: 'achievements.oracle.desc',               valueLabel: '€ stake' },
    { id: 'the_bookie',           icon: '?', nameKey: 'achievements.theBookie.name',            descKey: 'achievements.theBookie.desc',            valueLabel: 'wins' },
    { id: 'nostradamus',          icon: '?', nameKey: 'achievements.nostradamus.name',          descKey: 'achievements.nostradamus.desc',          valueLabel: '€ stake' },
    { id: 'swiss_army_knife',     icon: '?', nameKey: 'achievements.swissArmyKnife.name',       descKey: 'achievements.swissArmyKnife.desc',       valueLabel: '' },
]
