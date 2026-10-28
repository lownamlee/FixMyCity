param([switch]$EnablePrivacyOcr)
$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if(!(Test-Path -LiteralPath '.ml-venv/Scripts/python.exe')) {
  uv venv --python 3.12 .ml-venv
  if($LASTEXITCODE -ne 0){throw 'Could not create the Python 3.12 environment.'}
}
uv pip install --python .ml-venv/Scripts/python.exe -r tools/vision-requirements.txt
if($LASTEXITCODE -ne 0){throw 'Could not install the local vision packages.'}
& '.ml-venv/Scripts/python.exe' -c "from transformers import CLIPModel,CLIPProcessor; from facenet_pytorch import MTCNN; CLIPModel.from_pretrained('openai/clip-vit-base-patch32',revision='c237dc49a33fc61debc9276459120b7eac67e7ef',use_safetensors=True); CLIPProcessor.from_pretrained('openai/clip-vit-base-patch32'); MTCNN(keep_all=True); print('Local privacy and classification models ready.')"
if($LASTEXITCODE -ne 0){throw 'Could not load the local vision models.'}
if($EnablePrivacyOcr) {
  if(-not $env:FMC_TESSERACT_CMD -and -not (Get-Command tesseract -ErrorAction SilentlyContinue)) {
    throw 'Install Tesseract OCR and add it to PATH, or set FMC_TESSERACT_CMD.'
  }
  $taskModel = if($env:FMC_PRESIDIO_SPACY_MODEL) {$env:FMC_PRESIDIO_SPACY_MODEL} else {'en_core_web_sm'}
  & '.ml-venv/Scripts/python.exe' -m spacy download $taskModel
  if($LASTEXITCODE -ne 0){throw 'Could not install the Presidio language model.'}
  Write-Host 'Set FMC_PRIVACY_OCR=1 when starting FixMyCity to enable OCR and Presidio.'
}
