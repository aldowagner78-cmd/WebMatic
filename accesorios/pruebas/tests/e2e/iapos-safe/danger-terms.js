"use strict";

const DANGEROUS_TERMS = [
  "Autorizar",
  "Autorizacion",
  "Autorización",
  "Aprobar",
  "Confirmar",
  "Guardar",
  "Grabar",
  "Eliminar",
  "Borrar",
  "Anular",
  "Rechazar",
  "Modificar",
  "Actualizar",
  "Enviar",
  "Procesar",
  "Finalizar",
  "Aceptar",
  "Imprimir autorizacion",
  "Imprimir autorización",
  "Cargar comentario",
  "Registrar",
  "Dar de baja",
  "Replicar",
  "Documentos",
  "Accion",
  "Acción",
  "Delete",
  "Update",
  "Save",
  "Submit",
  "Approve",
  "Reject",
  "Confirm"
];

const SAFE_READONLY_TERMS = ["Buscar", "Consultar", "Filtrar"];

module.exports = {
  DANGEROUS_TERMS,
  SAFE_READONLY_TERMS
};
