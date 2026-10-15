"use client";

import Swal from "sweetalert2/dist/sweetalert2.js";
import type { SweetAlertOptions } from "sweetalert2";

const options = {
  background: "var(--bg)",
  color: "var(--ink)",
  iconColor: "var(--accent)",
  backdrop: "#2b302b66",
  buttonsStyling: false,
  heightAuto: false,
  keydownListenerCapture: true,
  confirmButtonText: "Aceptar",
  cancelButtonText: "Cancelar",
  reverseButtons: true,
  customClass: {
    container: "app-dialog-container",
    popup: "app-dialog",
    title: "app-dialog-title",
    htmlContainer: "app-dialog-text",
    actions: "app-dialog-actions",
    confirmButton: "button primary",
    cancelButton: "button",
    input: "app-dialog-input",
    validationMessage: "app-dialog-validation",
  },
} satisfies SweetAlertOptions;

export const appDialog = Swal.mixin(options);
