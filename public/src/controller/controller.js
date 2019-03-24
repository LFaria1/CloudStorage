class Controller {
    constructor() {
        this.btnSendFileEl = document.querySelector("#btn-send-file");
        this.inputFileEl = document.querySelector("#files");
        this.snackBar = document.querySelector("#react-snackbar-root");
        this.snackBarProgress = document.querySelector(".mc-progress-bar-fg");
        this.fileName = document.querySelector(".filename");
        this.timeLeftEl = document.querySelector(".timeleft");
        this.listFiles = document.querySelector("#list-of-files-and-directories");
        this.newFolderEl = document.querySelector("#btn-new-folder");
        this.renameEl = document.querySelector("#btn-rename");
        this.deleteEl = document.querySelector("#btn-delete");
        this.customEv = new Event('filesSelected');
        this.currentPath = ["files"];
        this.breadCrumb = document.querySelector("#browse-location");

        this.connectFB();
        this.startUpTime = 0;
        this.initEvents();
        this.readFilesFB();
    }
    //Os arquivos ficam guardados no Firebase Storage, enquanto sua referência fica guardada no Firebase Database

    connectFB() {

        // Initialize Firebase
        var config = {
            apiKey: "AIzaSyCFUk71bXvRglH9gFkSaLKLG_HqNMEECYk",
            authDomain: "dbteste-c3ff5.firebaseapp.com",
            databaseURL: "https://dbteste-c3ff5.firebaseio.com",
            projectId: "dbteste-c3ff5",
            storageBucket: "dbteste-c3ff5.appspot.com",
            messagingSenderId: "729588647234"
        };
        firebase.initializeApp(config);
        var rootRef = firebase.database().ref();

    }
    //contar n de arquivos selecionados
    nOfSelected() {
        return this.listFiles.querySelectorAll(".selected");
    }
    //inicializando eventos
    initEvents() {
        this.listFiles.addEventListener('filesSelected', e => {

            switch (this.nOfSelected().length) {
                //Botões de renomear e excluir só aparecem quando há algum botão selecionado
                case 0:
                    this.renameEl.style.display = "none";
                    this.deleteEl.style.display = "none";
                    break;
                case 1:
                    this.renameEl.style.display = "block";
                    this.deleteEl.style.display = "block";
                    break;
                default:
                    this.renameEl.style.display = "none";
                    this.deleteEl.style.display = "block";
                    break;
            }
        });
        this.renameEl.addEventListener("click", e => {
            //nOfSelected retorna todos os li selecionados
            let li = this.nOfSelected()[0];
            let key = li.dataset.key;
            let item = this.getFBRef().child(key);
            let name;
            //não retorna objeto, retorna a snapshot do objeto;
            item.on("value", snapshot => {
                console.log(name = snapshot.val().name);
            });

            let value = prompt("Renomear arquivo: ", name)
            if (value) {
                item.update({ name: `${value}` });
            }
        });

        this.deleteEl.addEventListener("click", e => {
            //Deletando a referência no Firebase Database e o arquivo no Firebase Storage            
            let selected = this.nOfSelected();
            selected.forEach(li => {
                let key = li.dataset.key;
                let child = this.getFBRef(this.currentPath.join("/")).child(key);
                child.once("value", snapshot => {
                    let name = snapshot.val().name;
                    
                    this.deleteStuff(snapshot.key).then((res, err) => {
                        console.log(this.currentPath.join("/") + "/" + name);

                    }).catch(e => { console.error(e + "2") });
                });

            });
        });

        this.newFolderEl.addEventListener("click", e => {
            this.createFolder();
        });

        this.btnSendFileEl.addEventListener("click", e => {           
            this.inputFileEl.click();
        });

        //Evento do botão de upload do arquivo
        this.inputFileEl.addEventListener("change", e => {
            this.uploadTask(e.target.files).then(resp => {
                resp.forEach(res => {
                    res.ref.getDownloadURL().then(data => {
                        //joga dentro do Firebase database, não dentro do Firebase Storage                
                        this.getFBRef(this.currentPath.join("/")).push().set({
                            name: res.name,
                            type: res.contentType, size: res.size, path: data
                        });
                    }).catch(e => { 
                        console.error(e) 
                    });
                });
                this.modalDisplay(false);
            }).catch(e => { console.error(e) });;
            this.modalDisplay(true);
            this.inputFileEl.value = "";
        });
    }
    //FIM inicializando eventos

    //INICIO deleteStuff
    deleteStuff(key, ref = this.currentPath.join("/")) {
        return new Promise((result, reject) => {
            let upref = ref;
            let child = this.getFBRef(ref).child(key);

            child.once("value", snapshot => {
                let type = snapshot.val().type;
                let name = snapshot.val().name;
                //Para deletar a pasta, cada item dentro da pasta deve ser deletado individualmente
                if (type === "folder") {
                    this.getFBRef(upref + "/" + name).once("value", snapshot => {
                        snapshot.forEach(item => {
                        
                            this.deleteStuff(item.key, upref + "/" + name).then(() => {
                                child.remove();
                                result("removed");
                            }

                            ).catch(e => { console.error(e + "1") });

                        });

                    });

                } else if (type) {
                    snapshot.ref.remove();
                    firebase.storage().ref(upref + "/" + name).delete().then().catch(e => { console.error(e); });
                    result("removed");
                }
            });
        });
    }
    //FIM deleteStuff

    
    createFolder() {
        //Criando a pasta no firebase database. No firebase storage, todos os arquivos estão na mesma pasta
        let name = prompt("Digite o nome da pasta");
        if (name) {

            this.getFBRef(this.currentPath.join("/")).push({
                name,
                type: "folder",
                path: this.currentPath.join("/")
            });
        }
    }

    
    getFBRef(path = "files") {
        return firebase.database().ref(path);
    }

    //INICIO uploadTask
    uploadTask(files) {
        let promises = [];
        //converter coleções para arrays
        [...files].forEach(file => {
            //Promise para dar push no firebase storage
            promises.push(new Promise((resolve, reject) => {
                let fr = firebase.storage().ref(this.currentPath.join("/")).child(file.name);
                let task = fr.put(file);
                this.fileName.innerHTML = file.name;
                task.on("state_changed", snapshot => {
                    this.uploadProgress({
                        loaded: snapshot.bytesTransferred,
                        total: snapshot.totalBytes
                    }, file);

                }, error => {
                    reject(error);
                }, () => {
                    fr.getMetadata().then(metadata => {
                        resolve(metadata);

                    }).catch(err => {
                        reject(err);
                    });

                });

            }));

        });
        return Promise.all(promises);
    }
    //FIM uploadTask

    //INICIO uploadProgress
    uploadProgress(e, file) {

        let loaded = e.loaded;
        let total = e.total;
        let percent = parseInt((loaded / total) * 100);
        this.snackBarProgress.style.width = percent + "%";
        let timeSpent = parseInt(Date.now() - this.startUpTime);
        let timeLeft = (100 - percent) * timeSpent / percent;
        timeLeft = Math.ceil(timeLeft / 1000);
        //se não puder calcular, então tempo é mostrado como 0
        if (!isFinite(timeLeft)) {
            timeLeft = 0;
        }

        if (Math.floor(timeLeft > 59)) {
            let min = Math.floor(timeLeft / 60);

            min > 1 ? this.timeLeftEl.innerHTML = `${min} mins restantes` :
                this.timeLeftEl.innerHTML = `${min} min restante`;

        } else {
            this.timeLeftEl.innerHTML = `${timeLeft} sec restantes`;
        }
    }
    //FIM uploadProgress

    modalDisplay(show = true) {
        this.snackBar.style.display = (show) ? "block" : "none";
    }

    //Cria a <li> do arquivo que será mostrado na tela
    getFileType(file, key) {
        let li = document.createElement("li");
        li.dataset.key = key;
        li.innerHTML = `
        ${svgIcon.getSvg(file)}       
        <div class="name text-center">${file.name}</div>
    `;
        this.liEvents(li);
        return li;
    }


    readFilesFB(path = "files") {
        //lê os arquivos do firebase database e imprime na tela
        this.getFBRef(path).on('value', snapshot => {
            this.listFiles.innerHTML = "";

            snapshot.forEach(snapItem => {
                let key = snapItem.key;
                let data = snapItem.val();
                if (data.type) {
                    this.listFiles.appendChild(this.getFileType(data, key));
                }
            });
        });
        this.updateBreadCrumb();
    }


    breadCrumbLink(span, subPath) {
        span.addEventListener("click", e => {
            let bcLength = this.breadCrumb.childNodes.length;
            this.currentPath = subPath;
            this.readFilesFB(this.currentPath.join("/"));
        });
    }
    
    //FIM updateBreadCrumb  
    updateBreadCrumb() {
        let len = this.currentPath.length;
        //atualizando breacrumb toda vez que há mudança na página
        this.breadCrumb.innerHTML = "";
        for (let i = 0; i < len; i++) {
            let subPath = this.currentPath.slice(0, i + 1);
            let span = document.createElement("span");
            if (i + 1 == this.currentPath.length) {
                span.innerHTML = subPath[i];
            } else {
                this.getFBRef(subPath.join("/"));
                span.classList.add("breadcrumb-segment__wrapper");
                span.innerHTML = `
        <span class="ue-effect-container uee-BreadCrumbSegment-link-0">
            <a href ="#" class="breadcrumb-segment">${subPath[i]}</a>
        </span>
        <svg width="24" height="24" viewBox="0 0 24 24" class="mc-icon-template-stateless" style="top: 4px; position: relative;">
            <title>arrow-right</title>
            <path d="M10.414 7.05l4.95 4.95-4.95 4.95L9 15.534 12.536 12 9 8.464z" fill="#637282"
                fill-rule="evenodd"></path>
        </svg>
    `;
            }
            this.breadCrumb.appendChild(span);
            this.breadCrumbLink(span, subPath);
        }
    }
    //FIM updateBreadCrumb


    //INICIO liEvents
    liEvents(li) {
        //Adicionando eventos ao <li> quando o objeto é lido do database
        li.addEventListener("dblclick", e => {
            let item = this.getFBRef(this.currentPath.join("/")).child(li.dataset.key);
            //snapshot do objeto
            item.once("value", snapshot => {
            }).then((res) => {
                switch (res.val().type) {
                    case "folder":

                        this.getFBRef(this.currentPath.join("/")).off("value");
                        this.currentPath.push(res.val().name);
                        this.readFilesFB(this.currentPath.join("/"));
                        break;

                    default:
                        window.open(res.val().path);
                        break;
                }

            });
        });

        li.addEventListener("click", e => {
            //Selecionar quando clicar em um arquivo na interface
            //Multiplas seleções se o shift/crtl está pressionado
            if (e.shiftKey) {
                let firstLi = this.listFiles.querySelector(".selected");
                if (firstLi) {
                    let ul = li.parentElement.childNodes;
                    let init;
                    let end;
                    ul.forEach((el, index) => {
                        if (firstLi === el) { init = index; }
                        if (li === el) { end = index; }

                    });
                    let sort = [init, end].sort();

                    ul.forEach((el, i) => {
                        if (i >= sort[0] && i <= sort[1]) {
                            el.classList.add("selected");
                        }
                    });
                    this.listFiles.dispatchEvent(this.customEv);
                    return true;
                }

            } if (!e.ctrlKey) {
                this.listFiles.querySelectorAll("li.selected").forEach(liList => {
                    if (!li.selected) {
                        liList.classList.remove("selected");
                    }

                });

            }
            li.classList.toggle("selected");
            this.listFiles.dispatchEvent(this.customEv);

        });
    }
    //FIM liEvents

}