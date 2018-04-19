FROM node:8
RUN useradd --create-home -s /bin/bash tacmap-pli
WORKDIR /home/tacmap-pli
COPY . /home/tacmap-pli
RUN rm -Rf /home/tacmap-pli/node_modules
ADD package.json /tmp/package.json
RUN cd /tmp && npm install
RUN cp -a /tmp/node_modules /home/tacmap-pli
RUN cd /home/tacmap-pli
CMD node tacmap_pli.js --public
EXPOSE 8080