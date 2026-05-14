from django.contrib import admin
from voluntariado.models import Oportunidade, InscricaoVoluntariado, Certificado


@admin.register(Oportunidade)
class OportunidadeAdmin(admin.ModelAdmin):
    list_display = (
        'titulo', 'organizacao', 'area', 'local',
        'vagas', 'status', 'requer_aprovacao', 'created_at',
    )
    list_filter = ('area', 'status', 'requer_aprovacao')
    search_fields = ('titulo', 'descricao', 'local', 'organizacao__nome_completo')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(InscricaoVoluntariado)
class InscricaoVoluntariadoAdmin(admin.ModelAdmin):
    list_display = (
        'estudante', 'oportunidade', 'status',
        'horas_realizadas', 'created_at',
    )
    list_filter = ('status',)
    search_fields = (
        'estudante__nome_completo', 'estudante__cpf',
        'oportunidade__titulo',
    )
    readonly_fields = ('id', 'created_at', 'updated_at', 'avaliado_em')


@admin.register(Certificado)
class CertificadoAdmin(admin.ModelAdmin):
    list_display = (
        'codigo_validacao', 'nome_estudante',
        'nome_oportunidade', 'horas_realizadas', 'emitido_em',
    )
    search_fields = (
        'codigo_validacao', 'nome_estudante',
        'cpf_estudante', 'nome_oportunidade',
    )
    readonly_fields = tuple(
        f.name for f in Certificado._meta.fields
    )  # Tudo readonly: certificado e imutavel apos emissao
