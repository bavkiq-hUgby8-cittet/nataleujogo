import { readFile, writeFile } from "node:fs/promises";
const root = JSON.parse(await readFile("../../database.rules.json", "utf8"));
const game =
  "root.child('familias').child($family).child('jogos').child('torrecidade')";
const family = "root.child('familias').child($family)";
const admin = `auth != null && auth.uid == ${family}.child('adminUid').val()`;
function roomRules(base) {
  const member = `auth != null && (${admin} || ${base}.child('jogadores').child(auth.uid).exists())`;
  const host = `${member} && auth.uid == ${base}.child('host/uid').val() && ${base}.child('config/closed').val() == false`;
  const epoch = `newData.child('epoch').val() == ${base}.child('host/epoch').val()`;
  const online = `${base}.child('online').child(auth.uid).hasChildren()`;
  const envelope = (limit) => ({
    ".write": host,
    ".validate": `newData.hasChildren(['epoch','payload']) && ${epoch} && newData.child('payload').isString() && newData.child('payload').val().length <= ${limit}`,
    epoch: { ".validate": "newData.isNumber()" },
    payload: {
      ".validate": `newData.isString() && newData.val().length <= ${limit}`,
    },
    t: { ".validate": "newData.isNumber()" },
    $other: { ".validate": false },
  });
  return {
    ".read": member,
    config: {
      ".read": admin,
      ".write": admin,
      ".validate":
        "newData.hasChildren(['mode','difficulty','theme','invite','created','closed'])",
      mode: {
        ".validate":
          "newData.val() == 'torre' || newData.val() == 'cidade' || newData.val() == 'mundo'",
      },
      difficulty: {
        ".validate":
          "newData.val() == 'familia' || newData.val() == 'normal' || newData.val() == 'desafio'",
      },
      theme: {
        ".validate": "newData.val() == 'neutro' || newData.val() == 'natal'",
      },
      invite: {
        ".validate":
          "newData.isString() && newData.val().matches(/^[a-f0-9]{48}$/)",
      },
      created: { ".validate": "newData.isNumber()" },
      closed: { ".validate": "newData.isBoolean()" },
      $other: { ".validate": false },
    },
    jogadores: {
      $uid: {
        ".read": "auth != null && auth.uid == $uid",
        ".write": `auth != null && auth.uid == $uid && ${base}.child('config/closed').val() == false && newData.child('convite').val() == ${base}.child('config/invite').val()`,
        ".validate":
          "newData.hasChildren(['nome','avatar','convite','entrouEm','ready'])",
        nome: {
          ".validate":
            "newData.isString() && newData.val().length >= 1 && newData.val().length <= 30",
        },
        avatar: {
          ".validate": "newData.isString() && newData.val().length <= 8",
        },
        convite: {
          ".validate": "newData.isString() && newData.val().length == 48",
        },
        entrouEm: {
          ".validate":
            "newData.isNumber() && ((!data.exists() && newData.val() <= now + 1000 && newData.val() >= now - 10000) || newData.val() == data.val())",
        },
        ready: { ".validate": "newData.isBoolean()" },
        $other: { ".validate": false },
      },
    },
    online: {
      $uid: {
        $instance: {
          ".write": `${member} && auth.uid == $uid`,
          ".validate": "newData.val() == true && $instance.length <= 64",
        },
      },
    },
    host: {
      ".write": `${member} && ${online} && newData.child('uid').val() == auth.uid && ${base}.child('online').child(auth.uid).child(newData.child('instance').val()).val() == true && ((!data.exists() && newData.child('epoch').val() == 1) || (data.exists() && newData.child('epoch').val() == data.child('epoch').val() + 1 && (!${base}.child('online').child(data.child('uid').val()).child(data.child('instance').val()).exists() || ${base}.child('hostBeat/t').val() < now - 2800)))`,
      ".validate": "newData.hasChildren(['uid','instance','epoch','desde'])",
      uid: { ".validate": "newData.isString()" },
      instance: {
        ".validate": "newData.isString() && newData.val().length <= 64",
      },
      epoch: { ".validate": "newData.isNumber() && newData.val() >= 1" },
      desde: {
        ".validate":
          "newData.isNumber() && newData.val() >= now - 2000 && newData.val() <= now + 1000",
      },
      $other: { ".validate": false },
    },
    hostBeat: {
      ".write": host,
      ".validate": `newData.hasChildren(['epoch','t']) && ${epoch}`,
      epoch: { ".validate": "newData.isNumber()" },
      t: {
        ".validate":
          "newData.isNumber() && newData.val() >= now - 2000 && newData.val() <= now + 1000",
      },
      $other: { ".validate": false },
    },
    inputs: {
      $uid: {
        ".write": `${member} && auth.uid == $uid && ${online}`,
        ".validate": "newData.hasChildren(['seq','type','data','t'])",
        seq: {
          ".validate":
            "newData.isNumber() && newData.val() % 1 == 0 && newData.val() > 0 && newData.val() <= 1000000000 && (!data.exists() || newData.val() == data.val()+1)",
        },
        type: {
          ".validate":
            "newData.isString() && newData.val().matches(/^(mover|girar|soltar|escolher|catalogo|escora|segurar|repor|iniciar|proxima|bairro|trocar)$/)",
        },
        data: {
          ".validate":
            "newData.isString() && newData.val().length <= 48 && newData.val().matches(/^[ -~]*$/)",
        },
        t: {
          ".validate":
            "newData.isNumber() && newData.val() >= now - 2000 && newData.val() <= now + 1000 && (!data.exists() || newData.val() >= data.val() + 65)",
        },
        $other: { ".validate": false },
      },
    },
    estado: {
      snapshot: envelope(220000),
      frame: envelope(14000),
      eventos: envelope(4000),
    },
    pings: {
      $uid: {
        ".write": `${member} && auth.uid == $uid`,
        ".validate": "newData.hasChildren(['type','x','z','t'])",
        type: {
          ".validate":
            "newData.isString() && newData.val().matches(/^(aqui|cuidado|espera|boa|gira|esquerda|solta)$/)",
        },
        x: {
          ".validate":
            "newData.isNumber() && newData.val() >= -100 && newData.val() <= 100",
        },
        z: {
          ".validate":
            "newData.isNumber() && newData.val() >= -100 && newData.val() <= 100",
        },
        t: {
          ".validate":
            "newData.isNumber() && newData.val() >= now - 2000 && newData.val() <= now + 1000 && (!data.exists() || newData.val() >= data.val() + 1000)",
        },
        $other: { ".validate": false },
      },
    },
    placar: {
      ".write": host,
      ".validate": `newData.hasChildren(['epoch','scores']) && ${epoch}`,
      epoch: { ".validate": "newData.isNumber()" },
      scores: {
        $id: {
          ".validate":
            "newData.hasChildren(['height','stars','time']) && (!data.exists() || newData.val() == data.val())",
          height: {
            ".validate":
              "newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000",
          },
          stars: {
            ".validate":
              "newData.isNumber() && newData.val() >= 1 && newData.val() <= 3",
          },
          time: { ".validate": "newData.isNumber() && newData.val() >= 0" },
          $other: { ".validate": false },
        },
      },
      $other: { ".validate": false },
    },
    chunks: { $chunk: envelope(64000) },
    contribuicoes: envelope(8000),
    linhaDoTempo: envelope(16000),
    checkpoint: {
      ".write": host,
      ".validate": `newData.hasChildren(['epoch','versao','salvoEm','revision']) && ${epoch}`,
      epoch: { ".validate": "newData.isNumber()" },
      versao: { ".validate": "newData.val() == 1" },
      salvoEm: { ".validate": "newData.isNumber()" },
      revision: { ".validate": "newData.isNumber()" },
      $other: { ".validate": false },
    },
    $other: { ".validate": false },
  };
}
root.rules.familias = {
  $family: {
    adminUid: {
      ".read": "auth != null && auth.uid == $family",
      ".write":
        "auth != null && auth.uid == $family && auth.token.email != null && !data.exists() && newData.val() == auth.uid",
    },
    jogos: {
      torrecidade: {
        salas: {
          $room: {
            ...roomRules(game + ".child('salas').child($room)"),
            ".write": `$room == 'ensaio' && (${admin}) && !newData.exists()`,
          },
        },
        mundo: roomRules(game + ".child('mundo')"),
      },
    },
  },
};
const recordBase = game + ".child('salas').child(newData.child('sala').val())";
root.rules.familias.$family.jogos.torrecidade.recordes = {
  ".read": admin,
  $match: {
    ".read": `auth != null && (!data.exists() || ${game}.child('salas').child(data.child('sala').val()).child('jogadores').child(auth.uid).exists())`,
    ".write": `auth != null && !data.exists() && auth.uid == ${recordBase}.child('host/uid').val() && newData.child('epoch').val() == ${recordBase}.child('host/epoch').val()`,
    ".validate":
      "newData.hasChildren(['sala','epoch','height','stars','time'])",
    sala: { ".validate": "newData.isString() && newData.val().length <= 6" },
    epoch: { ".validate": "newData.isNumber()" },
    height: {
      ".validate":
        "newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000",
    },
    stars: {
      ".validate":
        "newData.isNumber() && newData.val() >= 1 && newData.val() <= 3",
    },
    time: { ".validate": "newData.isNumber() && newData.val() >= 0" },
    $other: { ".validate": false },
  },
};
await writeFile(
  "database.rules.json",
  JSON.stringify({ rules: { familias: root.rules.familias } }, null, 2) + "\n",
);
await writeFile(
  "../../database.rules.json",
  JSON.stringify(root, null, 2) + "\n",
);
