import { extractNumEncounters } from '@/challenge/lichess';

describe('extractNumEncounters', function() {
  it('should work for integers', function() {
    const numEncounters = extractNumEncounters(
      '<div class="upt__info"><div class="upt__info__top"><div class="left"><a class="online user-link" href="/@/Testuser"><i class="line"></i>Testuser</a></div></div><div class="upt__info__ratings"><span title="Bullet rating over 8.203 games" data-icon="T" class="text">2200</span><span title="Blitz rating over 916 games" data-icon=")" class="text">2170</span><span title="Schnellschach rating over 26 games" data-icon="#" class="text">2057?</span><span title="Klassisch rating over 0 games" data-icon="+" class="text">&nbsp;&nbsp;&nbsp;-</span><span title="Antichess rating over 14 games" data-icon="@" class="text">1338?</span><span title="UltraBullet rating over 5 games" data-icon="{" class="text">1551?</span><span title="Crazyhouse rating over 0 games" data-icon="" class="text">&nbsp;&nbsp;&nbsp;-</span><span title="Chess960 rating over 0 games" data-icon="\'" class="text">&nbsp;&nbsp;&nbsp;-</span></div></div><div class="upt__actions btn-rack"><a data-icon="1" class="btn-rack__btn" title="Partien ansehen" href="/@/Testuser/tv"></a><a data-icon="c" class="btn-rack__btn" title="Chat" href="/inbox/Testuser"></a><a data-icon="U" class="btn-rack__btn" title="Zu einer Partie herausfordern" href="/?user=Testuser#friend"></a><a class="btn-rack__btn relation-button text" data-icon="h" href="/rel/follow/Testuser?mini=1">Folgen</a></div><a class="upt__score" href="/@/Testuser/me#games" title="3 Partien">Punktestand: <strong>1</strong> - <strong>2</strong></a>'
    );
    expect(numEncounters).toEqual(3);
  });

  it('should work for floats', function() {
    const numEncounters = extractNumEncounters(
      '<div class="upt__info"><div class="upt__info__top"><div class="left"><a class="online user-link" href="/@/Testuser"><i class="line"></i>Testuser</a></div></div><div class="upt__info__ratings"><span title="Bullet rating over 8.203 games" data-icon="T" class="text">2200</span><span title="Blitz rating over 916 games" data-icon=")" class="text">2170</span><span title="Schnellschach rating over 26 games" data-icon="#" class="text">2057?</span><span title="Klassisch rating over 0 games" data-icon="+" class="text">&nbsp;&nbsp;&nbsp;-</span><span title="Antichess rating over 14 games" data-icon="@" class="text">1338?</span><span title="UltraBullet rating over 5 games" data-icon="{" class="text">1551?</span><span title="Crazyhouse rating over 0 games" data-icon="" class="text">&nbsp;&nbsp;&nbsp;-</span><span title="Chess960 rating over 0 games" data-icon="\'" class="text">&nbsp;&nbsp;&nbsp;-</span></div></div><div class="upt__actions btn-rack"><a data-icon="1" class="btn-rack__btn" title="Partien ansehen" href="/@/Testuser/tv"></a><a data-icon="c" class="btn-rack__btn" title="Chat" href="/inbox/Testuser"></a><a data-icon="U" class="btn-rack__btn" title="Zu einer Partie herausfordern" href="/?user=Testuser#friend"></a><a class="btn-rack__btn relation-button text" data-icon="h" href="/rel/follow/Testuser?mini=1">Folgen</a></div><a class="upt__score" href="/@/Testuser/me#games" title="3 Partien">Punktestand: <strong>1.5</strong> - <strong>2.5</strong></a>'
    );
    expect(numEncounters).toEqual(4);
  });
});
