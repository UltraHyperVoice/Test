'use strict';

const ROUND_DURATION = 8 * 1000; //8 seconds

class Ambush {
	constructor(room, seconds) {
		this.players = new Map();
		this.round = 0;
		this.room = room;
		if (this.room.ambushCount) {
			this.room.ambushCount++;
		} else {
			this.room.ambushCount = 1;
		}
		this.timeLeft = Date.now() + seconds * 1000;

		this.room.add('|uhtml|ambush' + this.room.ambushCount + this.round + '|<div class = "infobox"><center>¡Un juego de Ambush ha sido comenzado!<br>' +
			'The game will begin in <b>' + seconds + '</b> seconds!<br>' +
			'<button name = "send" value = "/ambush unir">Unirse!</button></center></div>'
		);
		this.timer = setTimeout(() => {
			if (this.players.size < 3) {
				this.room.add('|uhtmlchange|ambush' + this.room.ambushCount + this.round + '|<div class = "infobox"><center>Este juego de Ambush ha terminado debido a la falta de jugadores.</center></div>').update();
				return this.end();
			}
			this.nextRound();
		}, seconds * 1000);
	}
	updateJoins() {
		let msg = 'ambush' + this.room.ambushCount + this.round + '|<div class = "infobox"><center>¡Un juego de Ambush ha sido comenzado!<br>' +
			'The game will begin in <b>' + Math.round((this.timeLeft - Date.now()) / 1000) + '</b> seconds<br>' +
			'<button name = "send" value = "/ambush unir">Unirse!</button></center>';
		if (this.players.size > 0) {
			msg += '<center><b>' + this.players.size + '</b> ' + (this.players.size === 1 ? 'user has' : 'users have') + ' joined: ' + Array.from(this.players).map(player => Chat.escapeHTML(player[0].name)).join(', ') + '</center>';
		}
		this.room.add('|uhtmlchange|' + msg + '</div>');
	}
	join(user, self) {
		if (!user.named) return self.errorReply("Debe elegir un nombre antes de unirse a un juego de Ambush.");
		if (this.players.has(user)) return self.sendReply('Ya te has unido a este juego de emboscada.');
		if (this.round > 0) return self.sendReply('Usted no puede unirse a un juego de Ambush después de que ha comenzado.');

		this.players.set(user, {status:'alive', rounds:0});
		this.updateJoins();
	}
	leave(user, self) {
		if (!this.players.has(user)) return self.sendReply('Aún no te has unido a este juego de Ambush.');

		this.players.delete(user);
		if (!this.round) {
			this.updateJoins();
		} else {
			this.room.add('|html|<b>' + Chat.escapeHTML(user.name) + ' ha abandonado el juego!</b>');
		}
	}
	getSurvivors() {
		return Array.from(this.players).filter(player => player[1].status === 'alive');
	}
	nextRound() {
		clearTimeout(this.timer);
		this.canShoot = false;
		if (this.checkWinner()) return this.getWinner();
		let survivors = this.getSurvivors();
		if (this.lastRoundSurvivors === survivors.length) {
			this.room.add('|html|<div class = "infobox"><center>Este juego de Ambush ha terminado debido a la inactividad, with <b>' + survivors.length + '</b> survivors.</center></div>');
			return this.end();
		}
		this.lastRoundSurvivors = survivors.length;

		this.round++;
		this.loadGuns();
		let msg = 'ambush' + this.room.ambushCount + this.round + '|<div class = "infobox"><center><b>Round ' + this.round + '</b><br>' +
			'Players: ' + survivors.map(player => Chat.escapeHTML(player[0].name)).join(', ') +
			'<br><small>Usa /fuego [usuario] para disparar a otro jugador!</small>';
		this.room.add('|uhtml|' + msg + '<br><i>Wait for it...</i></div>').update();

		this.release = setTimeout(() => {
			this.room.add('|uhtmlchange|' + msg + '<br><b style = "color:red; font-size: 12pt;">FUEGO!</b></div>').update();
			this.canShoot = true;
			this.resetTimer();
		}, (Math.floor(Math.random() * 12) + 3) * 1000);
	}
	fire(user, target, self) {
		let getUser = this.players.get(user);
		if (!getUser) return self.sendReply("Usted no es un jugador en este juego de Ambush.");
		this.madeMove = false;

		if (!this.canShoot) return self.sendReply("No se le permite disparar aún!");

		if (getUser.status === 'dead') return self.sendReply("No puedes disparar después de haber sido asesinado.!");
		if (!getUser.rounds) return self.sendReply("¡Estás fuera de la ronda! ¡No puedes disparar a nadie más! ");

		let targetUser = Users(target);
		if (!targetUser) return self.sendReply('User ' + target + ' not found.');
		if (!this.players.has(targetUser)) return self.sendReply(targetUser.name + ' is not a player!');
		if (this.players.get(targetUser).status === 'dead') return self.sendReply(targetUser.name + ' Ya a sido disparado!');

		this.players.get(user).rounds--;
		this.madeMove = true;
		if (targetUser === user) {
			this.room.add('|html|<b>' + user.name + ' shot themself!</b>');
		} else if (!this.players.get(targetUser).rounds) {
			this.room.add('|html|<b>' + Chat.escapeHTML(user.name) + ' fired at ' + Chat.escapeHTML(targetUser.name) + ', but ' + Chat.escapeHTML(targetUser.name) + ' tiene un escudo activo!</b>');
			return;
		} else {
			this.room.add('|html|<b>' + Chat.escapeHTML(user.name) + ' fired at ' + Chat.escapeHTML(targetUser.name) + '!</b>');
		}
		this.players.get(targetUser).status = 'dead';

		if (this.checkWinner()) this.getWinner();
	}
	loadGuns() {
		this.players.forEach((details, user) => {
			if (this.players.get(user).status === 'alive') this.players.get(user).rounds = 1;
		});
	}
	resetTimer() {
		this.timer = setTimeout(() => {
			this.nextRound();
			this.room.update();
		}, ROUND_DURATION);
	}
	dq(target, self) {
		if (!this.round) return self.sendReply('Sólo se puede descalificar a un jugador después de que la primera ronda haya comenzado.');
		let targetUser = Users(target);
		if (!targetUser) return self.sendReply('User ' + target + ' not found.');

		let getUser = this.players.get(targetUser);
		if (!getUser) return self.sendReply(targetUser.name + ' No es un jugador!');
		if (getUser.status === 'dead') return self.sendReply(targetUser.name + ' Ya a sido asesinado!');

		this.players.delete(targetUser);
		this.room.add('|html|<b>' + Chat.escapeHTML(targetUser.name) + ' a sido descalificado del juego.</b>');
		if (this.checkWinner()) this.getWinner();
	}
	checkWinner() {
		if (this.getSurvivors().length === 1) return true;
	}
	getWinner() {
		let winner = this.getSurvivors()[0][0].name;
		let msg = '|html|<div class = "infobox"><center>El ganador de este juego de Ambush es <b>' + Chat.escapeHTML(winner) + '!</b> Felicidades!</center>';
		if (this.room.id === 'marketplace') {
			msg += '<center>' + Chat.escapeHTML(winner) + ' tambien a ganado <b>5</b> creditos por ganar!</center>';
			writeCredits(winner, 5, () => this.room.add(msg).update());
		} else {
			this.room.add(msg).update();
		}
		this.end();
	}
	end(user) {
		if (user) {
			let msg = '<div class = "infobox"><center>Este juego de Ambush ha sido finalizado por <b>' + Chat.escapeHTML(user.name) + '</b></center></div>';
			if (!this.madeMove) {
				this.room.add('|uhtmlchange|ambush' + this.room.ambushCount + this.round + '|' + msg).update();
			} else {
				this.room.add('|html|' + msg).update();
			}
		}
		if (this.release) clearTimeout(this.release);
		clearTimeout(this.timer);
		delete this.room.ambush;
	}
}

let commands = {
	'': 'new',
	'start': 'new',
	'begin': 'new',
	'new': function (target, room, user) {
		if (room.ambush) return this.sendReply("Ya hay un juego de Ambush en esta sala.");
		if (room.isMuted(user) || user.locked) return this.errorReply("No puedes usar esto mientras no puedas hablar.");
		if (!user.can('broadcast', null, room)) return this.sendReply("Debes ser + o más alto en esta sala para comenzar un juego de Ambush.");

		if (!target || !target.trim()) target = '60';
		if (isNaN(target)) return this.sendReply('\'' + target + '\' is not a valid number.');
		if (target.includes('.') || target > 180 || target < 10) return this.sendReply('El número de segundos debe ser un número no decimal entre 10 y 180.');

		room.ambush = new Ambush(room, Number(target));
	},
	join: function (target, room, user) {
		if (!room.ambush) return this.sendReply("No hay juego de Ambush en esta sala.");
		if (room.isMuted(user) || user.locked) return this.errorReply("No puedes usar esto mientras no puedas hablar.");

		room.ambush.join(user, this);
	},
	leave: function (target, room, user) {
		if (!room.ambush) return this.sendReply("No hay juego de Ambush en esta sala.");

		room.ambush.leave(user, this);
	},
	proceed: function (target, room, user) {
		if (!room.ambush) return this.sendReply("No hay juego de Ambush en esta sala.");
		if (room.isMuted(user) || user.locked) return this.errorReply("No puedes usar esto mientras no puedas hablar.");
		if (!user.can('broadcast', null, room)) return this.sendReply("You must be ranked + or higher in this room to forcibly begin the first round of a game of ambush.");

		if (room.ambush.round) return this.sendReply('Este juego de Ambush ya ha comenzado!');
		if (room.ambush.players.size < 3) return this.sendReply('Todavía no hay suficientes jugadores. ¡Espera más para unirse!');
		room.add('(' + user.name + ' Inició la primera ronda)');
		room.ambush.nextRound();
	},
	disqualify: 'dq',
	dq: function (target, room, user) {
		if (!room.ambush) return this.sendReply("No hay juego de Ambush en esta sala.");
		if (room.isMuted(user) || user.locked) return this.errorReply("No puedes usar esto mientras no puedas hablar.");
		if (!user.can('mute', null, room)) return this.sendReply("Usted debe ser % o más alto en esta sala para descalificar a un usuario de un juego de Ambush.");

		room.ambush.dq(target, this);
	},
	shoot: 'fire',
	fire: function (target, room, user) {
		if (!room.ambush) return this.sendReply("No hay juego de Ambush en esta sala.");
		if (room.isMuted(user) || user.locked) return this.errorReply("No puedes usar esto mientras no puedas hablar.");

		room.ambush.fire(user, target, this);
	},
	cancel: 'end',
	end: function (target, room, user) {
		if (!room.ambush) return this.sendReply("No hay juego de ambush en esta sala.");
		if (!user.can('mute', null, room)) return this.sendReply("Usted debe ser % o más alto en esta sala para terminar un juego de Ambush.");

		room.ambush.end(user);
	},
	help: function () {
		this.parse('/ayuda ambush');
	},
};

exports.commands = {
	ambush: commands,
	fire: 'shoot',
	shoot: commands.fire,
	ambushhelp: [
		'/ambush iniciar [segundos] - Inicia un juego de Ambush en la sala. La primera ronda comenzará después del número de segundos mencionado (1 minuto por defecto). Requiere + o superior para usar.',
		'/ambush unir/salir - Se une / Sale un juego de Ambush .',
		'/ambush proceder - Comienza forzosamente la primera ronda del juego. Requiere + o superior para usar.',
		'/ambush dq [usuario] - Descalifica a un jugador de un juego de ambush. Requiere % o más alto para usar. ',
		'/ambush disparar/fuego [usuario] - Dispara a otro usuario (También puedes dispararte a ti mismo).',
		'/ambush terminar - Termina un juego de emboscada. Requiere % o más alto para usar.',
		'/ambush reglas - Muestra las reglas del juego.',
	],
};
