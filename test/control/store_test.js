import { Store, store } from "../../src/js/store.js";
import { assert, expect } from "../lib/chai/index.js";

mocha.setup("tdd");

suite("Store (unitaria)", () => {
    let testStore;
    const SESSION_KEY = "galeno_session";

    setup(() => {
        try {
            sessionStorage.removeItem(SESSION_KEY);
        } catch {
        }
        testStore = new Store();
    });

    teardown(() => {
        try {
            sessionStorage.removeItem(SESSION_KEY);
        } catch {
        }
        // Restaurar estado del singleton
        store.setState({
            token: null,
            usuario: null,
            roles: [],
            rolSeleccionado: null,
            clinicaActiva: null,
            online: true
        });
    });

    test("inicializa con estado predeterminado cuando sessionStorage está vacío", () => {
        const state = testStore.getState();
        expect(state.token).to.be.null;
        expect(state.usuario).to.be.null;
        expect(state.roles).to.be.an("array").that.is.empty;
        expect(state.rolSeleccionado).to.be.null;
        expect(state.clinicaActiva).to.be.null;
        expect(state.online).to.be.a("boolean");
        // Verifica alias heredados
        expect(state.session).to.equal(state.token);
        expect(state.activeClinic).to.equal(state.clinicaActiva);
        expect(state.selectedRole).to.equal(state.rolSeleccionado);
        expect(state.isOnline).to.equal(state.online);
    });

    test("setState actualiza el estado mediante objeto parcial y emite 'state-changed'", (done) => {
        const nuevoUsuario = { id: 10, nombre: "Dr. Morales" };

        testStore.addEventListener("state-changed", (evento) => {
            expect(evento.detail.token).to.equal("token-abc-123");
            expect(evento.detail.usuario).to.deep.equal(nuevoUsuario);
            expect(testStore.state.token).to.equal("token-abc-123");
            expect(testStore.state.usuario).to.deep.equal(nuevoUsuario);
            done();
        }, { once: true });

        testStore.setState({
            token: "token-abc-123",
            usuario: nuevoUsuario
        });
    });

    test("setState soporta pares clave/valor con alias heredados (session, activeClinic, isOnline)", () => {
        testStore.setState("session", "jwt-token-999");
        expect(testStore.state.token).to.equal("jwt-token-999");
        expect(testStore.getState().session).to.equal("jwt-token-999");

        const clinica = { idClinica: 4, nombre: "Clínica San Salvador" };
        testStore.setState("activeClinic", clinica);
        expect(testStore.state.clinicaActiva).to.deep.equal(clinica);
        expect(testStore.getState().activeClinic).to.deep.equal(clinica);

        const rol = { idRol: 2, nombre: "Médico General" };
        testStore.setState("selectedRole", rol);
        expect(testStore.state.rolSeleccionado).to.deep.equal(rol);

        testStore.setState("isOnline", false);
        expect(testStore.state.online).to.be.false;
        expect(testStore.getState().isOnline).to.be.false;
    });

    test("subscribe registra observador reactivo y la función devuelta cancela la suscripción", () => {
        let contadorLlamadas = 0;
        let ultimoEstado = null;

        const desuscribir = testStore.subscribe((evento) => {
            contadorLlamadas++;
            ultimoEstado = evento.detail;
        });

        testStore.setState({ token: "tok-1" });
        expect(contadorLlamadas).to.equal(1);
        expect(ultimoEstado.token).to.equal("tok-1");

        testStore.setState({ token: "tok-2" });
        expect(contadorLlamadas).to.equal(2);
        expect(ultimoEstado.token).to.equal("tok-2");

        desuscribir();

        testStore.setState({ token: "tok-3" });
        // No debe haberse invocado tras desuscribir
        expect(contadorLlamadas).to.equal(2);
        expect(testStore.state.token).to.equal("tok-3");
    });

    test("responde a eventos 'online' y 'offline' actualizando state.online y notificando", () => {
        const mensajes = [];
        const escucharNotificacion = (evento) => mensajes.push(evento.detail);

        window.addEventListener("notificacion", escucharNotificacion);

        try {
            window.dispatchEvent(new Event("offline"));
            expect(testStore.state.online).to.be.false;
            expect(testStore.getState().isOnline).to.be.false;

            const alerta = mensajes.find((mensaje) => mensaje.tipo === "warning");
            assert.isDefined(alerta);
            expect(alerta.titulo).to.equal("Sin conexión a internet");
            expect(alerta.detalle).to.contain("No hay conexión a internet");

            mensajes.length = 0;
            window.dispatchEvent(new Event("online"));
            expect(testStore.state.online).to.be.true;
            expect(testStore.getState().isOnline).to.be.true;

            const confirmacion = mensajes.find((mensaje) => mensaje.tipo === "success");
            assert.isDefined(confirmacion);
            expect(confirmacion.titulo).to.equal("Conexión restablecida");
        } finally {
            window.removeEventListener("notificacion", escucharNotificacion);
        }
    });

    test("setContextoTrabajo persiste en sessionStorage y actualiza clinicaActiva y rolSeleccionado", () => {
        const clinica = { idClinica: 1, nombre: "Hospital Central" };
        const rol = { idRol: 5, nombre: "Especialista" };

        testStore.setState({
            token: "token-sesion-fija",
            usuario: { id: 7, nombre: "Dra. Gomez" },
            roles: [rol]
        });

        testStore.setContextoTrabajo(clinica, rol);

        expect(testStore.state.clinicaActiva).to.deep.equal(clinica);
        expect(testStore.state.rolSeleccionado).to.deep.equal(rol);

        const guardadoRaw = sessionStorage.getItem(SESSION_KEY);
        expect(guardadoRaw).to.be.a("string");
        const guardado = JSON.parse(guardadoRaw);
        expect(guardado.token).to.equal("token-sesion-fija");
        expect(guardado.perfil).to.deep.equal({ id: 7, nombre: "Dra. Gomez" });
        expect(guardado.clinicaActiva).to.deep.equal(clinica);
        expect(guardado.rolSeleccionado).to.deep.equal(rol);
    });

    test("setClinicaActiva y setRolActivo actualizan el contexto individualmente", () => {
        const clinica = { idClinica: 2, nombre: "Sucursal Norte" };
        const rol = { idRol: 3, nombre: "Recepcionista" };

        testStore.setContextoTrabajo(clinica, rol);

        const nuevaClinica = { idClinica: 9, nombre: "Sucursal Sur" };
        testStore.setClinicaActiva(nuevaClinica);
        expect(testStore.state.clinicaActiva).to.deep.equal(nuevaClinica);
        expect(testStore.state.rolSeleccionado).to.deep.equal(rol);

        const nuevoRol = { idRol: 8, nombre: "Administrador" };
        testStore.setRolActivo(nuevoRol);
        expect(testStore.state.clinicaActiva).to.deep.equal(nuevaClinica);
        expect(testStore.state.rolSeleccionado).to.deep.equal(nuevoRol);
    });

    test("hidrata el estado desde sessionStorage al instanciar un nuevo Store", () => {
        const sesionPrevia = {
            token: "token-hidratado",
            perfil: { id: 30, nombre: "Enfermero Juan" },
            roles: [{ idRol: 10, nombre: "Enfermero" }],
            clinicaActiva: { idClinica: 3, nombre: "Clínica Oriente" },
            rolSeleccionado: { idRol: 10, nombre: "Enfermero" }
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(sesionPrevia));

        const storeHidratado = new Store();
        const state = storeHidratado.getState();

        expect(state.token).to.equal("token-hidratado");
        expect(state.usuario).to.deep.equal(sesionPrevia.perfil);
        expect(state.roles).to.deep.equal(sesionPrevia.roles);
        expect(state.clinicaActiva).to.deep.equal(sesionPrevia.clinicaActiva);
        expect(state.rolSeleccionado).to.deep.equal(sesionPrevia.rolSeleccionado);
    });
});
